"""Laya's answers as events: `status` ({"state": "loading"} then {"state": "ready", "load_ms"}, only when Laya was not
loaded), one `answer` per question as soon as it is answered, then `done` ({"total_ms"}) or `error` ({"message", "trace_id"}).
"""

import logging
import time
from collections.abc import Generator

from events import event, milliseconds_since
from laya_runner import LayaError, LayaRunner
from questions import AnswerError, AskRequest, read_answer

log = logging.getLogger("decide")


def answer_events(runner: LayaRunner, request: AskRequest, trace_id: str) -> Generator[str, None, None]:
    started = time.perf_counter()
    with runner.turn():
        if not runner.loaded:
            yield event("status", {"state": "loading"})
            runner.load()
            yield event("status", {"state": "ready", "load_ms": milliseconds_since(started)})
        for index, question in enumerate(request.questions):
            asked = time.perf_counter()
            raw = runner.predict(request.text, {"q": question.for_laya()})["q"]
            yield event("answer", read_answer(question, raw, index, milliseconds_since(asked)))
    log.info("[%s] Answered %d questions in %d ms.", trace_id, len(request.questions), milliseconds_since(started))
    yield event("done", {"total_ms": milliseconds_since(started)})


def decide_stream(runner: LayaRunner, request: AskRequest, trace_id: str) -> Generator[str, None, None]:
    try:
        yield from answer_events(runner, request, trace_id)
    except (LayaError, AnswerError) as error:
        log.warning("[%s] Failed: %s", trace_id, error)
        yield event("error", {"message": str(error), "trace_id": trace_id})
