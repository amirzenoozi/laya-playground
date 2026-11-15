import json
import logging
import threading
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from app import create_app
from ollama import OllamaClient
from laya_runner import AnswerRejected, LayaError, LayaRunner, RawAnswers
from settings import CHECKPOINT_FILE, Settings

TEXT = "The parcel arrived broken and nobody answers my emails."


class FakeAgent:
    """Answers like Laya: each type in its own shape, the yes/no probability fixed at 0.8."""

    def __init__(self, fail: Exception | None = None) -> None:
        self.fail = fail
        self.closed = False
        self.asked: list[dict[str, dict[str, object]]] = []

    def predict(self, text: str, questions: dict[str, dict[str, object]]) -> RawAnswers:
        self.asked.append(questions)
        if self.fail is not None:
            raise self.fail
        question = questions["q"]
        if question["type"] == "noul":
            return {"q": {"type": "noul", "noul": 0.8, "confidence": 0.8}}
        criteria = question["criteria"]
        labels = list(criteria) if isinstance(criteria, dict) else [str(index) for index in range(len(criteria))]  # type: ignore[arg-type]
        share = [0.1] * (len(labels) - 1) + [1 - 0.1 * (len(labels) - 1)]
        answer: dict[str, object] = {"type": question["type"], "confidence": 0.7, "probabilities": dict(zip(labels, share))}
        if question["type"] == "score":
            answer["score"] = len(labels) - 1.2
        return {"q": answer}

    def close(self) -> None:
        self.closed = True


class Fakes:
    def __init__(self, tmp_path: Path, keep_alive: int = 300) -> None:
        (tmp_path / CHECKPOINT_FILE).write_text("{}")
        self.settings = Settings(model_path=tmp_path, keep_alive=keep_alive, threads=1, ollama_url="http://ollama", ollama_keep_alive="5m")
        self.agents: list[FakeAgent] = []
        self.next_fail: Exception | None = None
        self.runner = LayaRunner(self.start, keep_alive)
        unused = OllamaClient("http://ollama", "5m", transport=httpx.MockTransport(lambda request: httpx.Response(503)))
        self.client = TestClient(create_app(self.settings, self.runner, unused))

    def start(self) -> FakeAgent:
        agent = FakeAgent(self.next_fail)
        self.agents.append(agent)
        return agent


@pytest.fixture
def fakes(tmp_path: Path) -> Fakes:
    return Fakes(tmp_path)


def events(body: str) -> list[tuple[str, dict[str, object]]]:
    found = []
    for block in body.strip().split("\n\n"):
        name_line, data_line = block.split("\n")
        found.append((name_line.removeprefix("event: "), json.loads(data_line.removeprefix("data: "))))
    return found


QuestionBody = dict[str, object]

YES_NO: QuestionBody = {"type": "noul", "instruction": "Is the writer unhappy?"}
CHOICE: QuestionBody = {
    "type": "choice",
    "instruction": "What is it about?",
    "options": [{"label": "billing"}, {"label": "delivery", "description": "shipping, parcels, couriers"}],
}
SCORE: QuestionBody = {"type": "score", "instruction": "How angry is the writer?", "levels": ["calm", "annoyed", "furious"]}


def ask(fakes: Fakes, *questions: dict[str, object], text: str = TEXT) -> list[tuple[str, dict[str, object]]]:
    response = fakes.client.post("/api/ask", json={"text": text, "questions": list(questions)})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers["x-trace-id"]
    return events(response.text)


def test_streams_loading_then_one_answer_per_question_then_done(fakes: Fakes) -> None:
    found = ask(fakes, YES_NO, CHOICE, SCORE)

    assert [name for name, _ in found] == ["status", "status", "answer", "answer", "answer", "done"]
    assert found[0][1] == {"state": "loading"}
    assert found[1][1]["state"] == "ready"
    yes_no, choice, score = (data for name, data in found if name == "answer")
    assert yes_no["winner"] == "yes"
    assert yes_no["probabilities"] == [{"label": "yes", "probability": 0.8}, {"label": "no", "probability": 0.2}]
    assert choice["winner"] == "delivery"
    assert choice["probabilities"] == [{"label": "billing", "probability": 0.1}, {"label": "delivery", "probability": 0.9}]
    assert score["winner"] == "furious"
    assert score["score"] == pytest.approx(1.8)
    assert [data["index"] for name, data in found if name == "answer"] == [0, 1, 2]


def test_puts_each_question_to_laya_in_its_own_shape(fakes: Fakes) -> None:
    ask(fakes, {**YES_NO, "yes": "they complain"}, CHOICE, SCORE)

    asked = [questions["q"] for questions in fakes.agents[0].asked]
    assert asked[0] == {"type": "noul", "instructions": "Is the writer unhappy?", "criteria": {"true": "they complain"}}
    assert asked[1]["criteria"] == {"billing": None, "delivery": "shipping, parcels, couriers"}
    assert asked[2]["criteria"] == ["calm", "annoyed", "furious"]


def test_a_loaded_laya_answers_without_loading_again(fakes: Fakes) -> None:
    ask(fakes, YES_NO)
    found = ask(fakes, YES_NO)

    assert [name for name, _ in found] == ["answer", "done"]
    assert len(fakes.agents) == 1


def test_no_keep_alive_unloads_after_each_request(tmp_path: Path) -> None:
    fakes = Fakes(tmp_path, keep_alive=0)
    ask(fakes, YES_NO)

    assert fakes.agents[0].closed
    assert fakes.client.get("/api/status").json()["loaded"] is False


def test_unloads_once_idle_for_the_keep_alive(fakes: Fakes, monkeypatch: pytest.MonkeyPatch) -> None:
    timers: list[threading.Timer] = []
    original = threading.Timer

    def recorded(*args: object, **kwargs: object) -> threading.Timer:
        timer = original(*args, **kwargs)  # type: ignore[arg-type]
        timers.append(timer)
        return timer

    monkeypatch.setattr(threading, "Timer", recorded)
    ask(fakes, YES_NO)
    ask(fakes, YES_NO)
    assert fakes.runner.loaded

    timers[0].cancel()
    timers[0].function(*timers[0].args)  # The first request's timer, after a later request: does nothing
    assert fakes.runner.loaded
    timers[1].cancel()
    timers[1].function(*timers[1].args)
    assert not fakes.runner.loaded
    assert fakes.agents[0].closed


def test_a_broken_laya_ends_the_stream_with_an_error_and_unloads(fakes: Fakes) -> None:
    fakes.next_fail = LayaError("Laya did not answer within 30s")
    found = ask(fakes, YES_NO, CHOICE)

    assert found[-1][0] == "error"
    assert found[-1][1]["message"] == "Laya did not answer within 30s"
    assert found[-1][1]["trace_id"]
    assert not any(name == "answer" for name, _ in found)
    assert not fakes.runner.loaded


def test_a_rejected_question_keeps_laya_loaded(fakes: Fakes) -> None:
    fakes.next_fail = AnswerRejected("Laya could not answer (ValueError)")
    found = ask(fakes, YES_NO)

    assert found[-1][0] == "error"
    assert fakes.runner.loaded


def test_missing_model_files_answer_503(tmp_path: Path) -> None:
    fakes = Fakes(tmp_path)
    (tmp_path / CHECKPOINT_FILE).unlink()
    response = fakes.client.post("/api/ask", json={"text": TEXT, "questions": [YES_NO]})

    assert response.status_code == 503
    assert "LAYA_MODEL_PATH" in response.json()["detail"]
    assert fakes.client.get("/api/status").json()["model_found"] is False


@pytest.mark.parametrize(
    "body",
    [
        {"text": "", "questions": [YES_NO]},
        {"text": "x" * 10_001, "questions": [YES_NO]},
        {"text": TEXT, "questions": []},
        {"text": TEXT, "questions": [YES_NO] * 11},
        {"text": TEXT, "questions": [{"type": "guess", "instruction": "?"}]},
        {"text": TEXT, "questions": [{**YES_NO, "instruction": " "}]},
        {"text": TEXT, "questions": [{**CHOICE, "options": [{"label": "only"}]}]},
        {"text": TEXT, "questions": [{**CHOICE, "options": [{"label": "Same"}, {"label": "same"}]}]},
        {"text": TEXT, "questions": [{**SCORE, "levels": ["low", "low"]}]},
        {"text": TEXT, "questions": [{**YES_NO, "extra": 1}]},
    ],
)
def test_refuses_invalid_requests_before_laya_loads(fakes: Fakes, body: dict[str, object]) -> None:
    response = fakes.client.post("/api/ask", json=body)

    assert response.status_code == 422
    assert fakes.agents == []


def test_logs_never_hold_the_text_or_questions(fakes: Fakes, caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.DEBUG)
    fakes.next_fail = LayaError("Laya's process ended (exit code 1)")
    ask(fakes, YES_NO)
    fakes.next_fail = None
    fakes.runner.shutdown()
    ask(fakes, CHOICE)

    assert caplog.text
    assert TEXT not in caplog.text
    assert "What is it about?" not in caplog.text
    assert "delivery" not in caplog.text
