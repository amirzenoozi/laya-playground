import json
import logging
from collections.abc import Callable
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from app import create_app
from laya_runner import LayaRunner
from ollama import OllamaClient
from settings import Settings

MODEL = "hf.co/mlabonne/gemma-3-4b-it-abliterated-GGUF:Q4_K_M"
QUESTION = "Give me three names for a quiet garden."
TAGS = {"models": [{"name": MODEL, "size": 2_490_000_000, "details": {"parameter_size": "3.88B"}}]}

Handler = Callable[[httpx.Request], httpx.Response]


def ollama_lines(*pieces: str, tokens: int = 7) -> bytes:
    lines = [{"message": {"role": "assistant", "content": piece}, "done": False} for piece in pieces]
    lines.append({"message": {"role": "assistant", "content": ""}, "done": True, "eval_count": tokens})
    return "".join(json.dumps(line) + "\n" for line in lines).encode()


class FakeOllama:
    """Answers /api/tags with one model and /api/chat with `reply`; records what each chat sent."""

    def __init__(self) -> None:
        self.sent: list[dict[str, object]] = []
        self.reply: Handler = lambda request: httpx.Response(200, content=ollama_lines("Fern", ", Moss", " and Willow."))
        self.down = False

    def __call__(self, request: httpx.Request) -> httpx.Response:
        if self.down:
            raise httpx.ConnectError("refused", request=request)
        if request.url.path == "/api/tags":
            return httpx.Response(200, json=TAGS)
        self.sent.append(json.loads(request.content))
        return self.reply(request)


class Fakes:
    def __init__(self, tmp_path: Path) -> None:
        settings = Settings(model_path=tmp_path, keep_alive=0, threads=1, ollama_url="http://ollama", ollama_keep_alive=300)
        self.ollama = FakeOllama()
        client = OllamaClient("http://ollama", 300, transport=httpx.MockTransport(self.ollama))
        self.client = TestClient(create_app(settings, LayaRunner(lambda: pytest.fail("Laya must not load"), 0), client))


@pytest.fixture
def fakes(tmp_path: Path) -> Fakes:
    return Fakes(tmp_path)


def events(body: str) -> list[tuple[str, dict[str, object]]]:
    found = []
    for block in body.strip().split("\n\n"):
        name_line, data_line = block.split("\n")
        found.append((name_line.removeprefix("event: "), json.loads(data_line.removeprefix("data: "))))
    return found


# The test client answers with its own Response type (httpx2), so the helper leaves the type to it
def chat(fakes: Fakes, **body: object):  # type: ignore[no-untyped-def]
    request = {"model": MODEL, "messages": [{"role": "user", "content": QUESTION}], **body}
    return fakes.client.post("/api/chat", json=request)


def test_lists_ollamas_models(fakes: Fakes) -> None:
    response = fakes.client.get("/api/models")

    assert response.json() == {"models": [{"name": MODEL, "size": 2_490_000_000, "parameters": "3.88B"}]}


def test_streams_the_reply_piece_by_piece_then_done(fakes: Fakes) -> None:
    response = chat(fakes)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers["x-trace-id"]
    found = events(response.text)
    assert found[:3] == [("token", {"text": "Fern"}), ("token", {"text": ", Moss"}), ("token", {"text": " and Willow."})]
    assert found[3][0] == "done"
    assert found[3][1]["tokens"] == 7
    assert isinstance(found[3][1]["first_token_ms"], int)


def test_sends_the_messages_as_given_with_keep_alive_and_options(fakes: Fakes) -> None:
    messages = [
        {"role": "system", "content": "Be brief."},
        {"role": "user", "content": QUESTION},
        {"role": "assistant", "content": "Fern."},
        {"role": "user", "content": "Two more."},
    ]
    chat(fakes, messages=messages, options={"temperature": 0.3, "max_tokens": 50})

    assert fakes.ollama.sent == [
        {"model": MODEL, "messages": messages, "stream": True, "keep_alive": 300, "options": {"temperature": 0.3, "num_predict": 50}}
    ]


def test_without_options_sends_none(fakes: Fakes) -> None:
    chat(fakes)

    assert "options" not in fakes.ollama.sent[0]


def test_an_error_from_ollama_mid_reply_ends_the_stream_with_it(fakes: Fakes) -> None:
    broken = ollama_lines("Fern")[:-1] + b'\n{"error": "model runner has unexpectedly stopped"}\n'
    fakes.ollama.reply = lambda request: httpx.Response(200, content=broken)

    found = events(chat(fakes).text)

    assert found[0] == ("token", {"text": "Fern"})
    assert found[-1][0] == "error"
    assert found[-1][1]["message"] == "Ollama: model runner has unexpectedly stopped"
    assert found[-1][1]["trace_id"]


def test_a_refused_chat_ends_the_stream_with_ollamas_reason(fakes: Fakes) -> None:
    fakes.ollama.reply = lambda request: httpx.Response(500, json={"error": "out of memory"})

    found = events(chat(fakes).text)

    assert found == [("error", {"message": "Ollama: out of memory", "trace_id": found[0][1]["trace_id"]})]


def test_ollama_down_answers_503(fakes: Fakes) -> None:
    fakes.ollama.down = True

    assert chat(fakes).status_code == 503
    response = fakes.client.get("/api/models")
    assert response.status_code == 503
    assert "not reachable" in response.json()["detail"]


def test_a_model_ollama_does_not_have_answers_404(fakes: Fakes) -> None:
    response = chat(fakes, model="llama-unknown")

    assert response.status_code == 404
    assert fakes.ollama.sent == []


@pytest.mark.parametrize(
    "body",
    [
        {"messages": []},
        {"messages": [{"role": "assistant", "content": "Hi"}]},
        {"messages": [{"role": "user", "content": "Hi"}, {"role": "system", "content": "Late"}, {"role": "user", "content": "Hi"}]},
        {"messages": [{"role": "user", "content": ""}]},
        {"messages": [{"role": "tool", "content": "Hi"}]},
        {"messages": [{"role": "user", "content": "x" * 20_001}]},
        {"messages": [{"role": "user", "content": "x" * 20_000}] * 11},
        {"messages": [{"role": "user", "content": "Hi"}] * 101},
        {"options": {"temperature": 3}},
        {"options": {"max_tokens": 0}},
        {"options": {"top_k": 5}},
        {"model": ""},
        {"extra": True},
    ],
)
def test_refuses_invalid_chats_before_asking_ollama(fakes: Fakes, body: dict[str, object]) -> None:
    assert chat(fakes, **body).status_code == 422
    assert fakes.ollama.sent == []


def test_logs_never_hold_the_messages_or_the_reply(fakes: Fakes, caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.DEBUG)
    chat(fakes, messages=[{"role": "system", "content": "Speak like a gardener."}, {"role": "user", "content": QUESTION}])
    fakes.ollama.reply = lambda request: httpx.Response(200, content=ollama_lines("Fern")[:-1] + b'\n{"error": "boom"}\n')
    chat(fakes)

    assert "Answered" in caplog.text
    assert QUESTION not in caplog.text
    assert "gardener" not in caplog.text
    assert "Fern" not in caplog.text
