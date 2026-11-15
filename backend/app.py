"""The playground's server: asks Laya the UI's questions and streams each answer as a Server-Sent Event.

Events, in order: `status` ({"state": "loading"} then {"state": "ready", "load_ms"}, only when Laya was not loaded),
one `answer` per question as soon as it is answered, then `done` ({"total_ms"}) or `error` ({"message"}).
The text and questions are never logged, only the trace id, counts and timings.
"""

import json
import logging
import os
import time
import uuid
from collections.abc import Iterator
from contextlib import asynccontextmanager
from logging.handlers import RotatingFileHandler
from typing import AsyncIterator

import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from laya_runner import LayaError, LayaRunner, ProcessAgent
from questions import AnswerError, AskRequest, read_answer
from settings import ROOT, Settings, load_settings

PORT = 8100
log = logging.getLogger("app")


def configure_logging() -> None:
    (ROOT / "logs").mkdir(exist_ok=True)
    handlers: list[logging.Handler] = [
        logging.StreamHandler(),
        RotatingFileHandler(ROOT / "logs" / "app.log", maxBytes=5_000_000, backupCount=3),
    ]
    level = os.environ.get("LOG_LEVEL", "INFO").strip().upper() or "INFO"
    logging.basicConfig(level=level, format="%(asctime)s %(levelname)s %(name)s: %(message)s", handlers=handlers, force=True)


def event(name: str, data: BaseModel | dict[str, object]) -> str:
    body = data.model_dump_json() if isinstance(data, BaseModel) else json.dumps(data)
    return f"event: {name}\ndata: {body}\n\n"


def milliseconds_since(start: float) -> int:
    return round((time.perf_counter() - start) * 1000)


def answer_events(runner: LayaRunner, request: AskRequest, trace_id: str) -> Iterator[str]:
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


def stream(runner: LayaRunner, request: AskRequest, trace_id: str) -> Iterator[str]:
    try:
        yield from answer_events(runner, request, trace_id)
    except (LayaError, AnswerError) as error:
        log.warning("[%s] Failed: %s", trace_id, error)
        yield event("error", {"message": str(error), "trace_id": trace_id})


def create_app(settings: Settings, runner: LayaRunner) -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        runner.shutdown()

    app = FastAPI(title="Laya playground", lifespan=lifespan)

    @app.get("/api/status")
    def status() -> dict[str, object]:
        return {"model_found": settings.model_found, "loaded": runner.loaded, "keep_alive": settings.keep_alive}

    @app.post("/api/ask", response_model=None)
    def ask(request: AskRequest) -> StreamingResponse | JSONResponse:
        if not settings.model_found:
            message = f"Laya's files are not in {settings.model_path}; set LAYA_MODEL_PATH in .env."
            return JSONResponse({"detail": message}, status_code=503)
        trace_id = uuid.uuid4().hex[:12]
        log.info("[%s] Asked %d questions about %d characters.", trace_id, len(request.questions), len(request.text))
        headers = {"Cache-Control": "no-cache", "X-Trace-Id": trace_id}
        return StreamingResponse(stream(runner, request, trace_id), media_type="text/event-stream", headers=headers)

    built = ROOT / "frontend" / "dist"
    if built.is_dir():
        app.mount("/", StaticFiles(directory=built, html=True), name="ui")
    return app


def main() -> None:
    settings = load_settings()
    configure_logging()
    if not settings.model_found:
        log.warning("Laya's files are not in %s; set LAYA_MODEL_PATH in .env.", settings.model_path)
    runner = LayaRunner(lambda: ProcessAgent(settings.model_path, settings.threads), settings.keep_alive)
    uvicorn.run(create_app(settings, runner), host="127.0.0.1", port=PORT, log_config=None)


if __name__ == "__main__":
    main()
