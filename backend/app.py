"""The playground's server: Laya's answers (`/api/ask`) and chats with Ollama's models (`/api/chat`), both streamed as
Server-Sent Events (see decide.py and chat.py), and the built UI.
"""

import logging
import os
import uuid
from contextlib import asynccontextmanager
from logging.handlers import RotatingFileHandler
from typing import AsyncIterator

import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from chat import ChatRequest, chat_stream
from decide import decide_stream
from events import event_stream
from laya_runner import LayaRunner, ProcessAgent
from ollama import OllamaClient, OllamaError
from questions import AskRequest
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
    # httpx logs every request to Ollama at INFO
    logging.getLogger("httpx").setLevel(logging.WARNING)


def new_trace_id() -> str:
    return uuid.uuid4().hex[:12]


def create_app(settings: Settings, runner: LayaRunner, ollama: OllamaClient) -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        runner.shutdown()
        ollama.close()

    app = FastAPI(title="Laya playground", lifespan=lifespan)

    @app.get("/api/status")
    def status() -> dict[str, object]:
        return {"model_found": settings.model_found, "loaded": runner.loaded, "keep_alive": settings.keep_alive}

    @app.post("/api/ask", response_model=None)
    def ask(request: AskRequest) -> StreamingResponse | JSONResponse:
        if not settings.model_found:
            message = f"Laya's files are not in {settings.model_path}; set LAYA_MODEL_PATH in .env."
            return JSONResponse({"detail": message}, status_code=503)
        trace_id = new_trace_id()
        log.info("[%s] Asked %d questions about %d characters.", trace_id, len(request.questions), len(request.text))
        return event_stream(decide_stream(runner, request, trace_id), trace_id)

    @app.get("/api/models", response_model=None)
    def models() -> dict[str, object] | JSONResponse:
        try:
            found = ollama.models()
        except OllamaError as error:
            return JSONResponse({"detail": str(error)}, status_code=503)
        return {"models": [{"name": model.name, "size": model.size, "parameters": model.parameters} for model in found]}

    @app.post("/api/chat", response_model=None)
    def chat(request: ChatRequest) -> StreamingResponse | JSONResponse:
        try:
            installed = {model.name for model in ollama.models()}
        except OllamaError as error:
            return JSONResponse({"detail": str(error)}, status_code=503)
        if request.model not in installed:
            return JSONResponse({"detail": f"Ollama has no model named {request.model}."}, status_code=404)
        trace_id = new_trace_id()
        log.info("[%s] Chat with %s, %d messages.", trace_id, request.model, len(request.messages))
        return event_stream(chat_stream(ollama, request, trace_id), trace_id)

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
    ollama = OllamaClient(settings.ollama_url, settings.ollama_keep_alive)
    uvicorn.run(create_app(settings, runner, ollama), host="127.0.0.1", port=PORT, log_config=None)


if __name__ == "__main__":
    main()
