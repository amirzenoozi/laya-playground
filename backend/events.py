"""Server-Sent Events, the format both streams (Laya's answers and chat replies) are sent in."""

import json
import threading
import time
from collections.abc import AsyncGenerator, Generator

from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool


def event(name: str, data: BaseModel | dict[str, object]) -> str:
    body = data.model_dump_json() if isinstance(data, BaseModel) else json.dumps(data)
    return f"event: {name}\ndata: {body}\n\n"


def milliseconds_since(start: float) -> int:
    return round((time.perf_counter() - start) * 1000)


async def closed_when_done(events: Generator[str, None, None]) -> AsyncGenerator[str, None]:
    """Runs a blocking stream in a thread and always closes it, also when the client goes away part way.

    On a disconnect Starlette cancels the response while a step may still be running in its thread; left alone, the
    stream would stay suspended forever, holding Laya's lock or the connection to Ollama. Closing waits for that step
    to end (the lock), so the stream's own cleanup (`finally`, `with`) runs.
    """
    step_lock = threading.Lock()

    def step() -> str | None:
        with step_lock:
            return next(events, None)

    def close() -> None:
        with step_lock:
            events.close()

    try:
        while (chunk := await run_in_threadpool(step)) is not None:
            yield chunk
    finally:
        threading.Thread(target=close, daemon=True).start()


def event_stream(events: Generator[str, None, None], trace_id: str) -> StreamingResponse:
    headers = {"Cache-Control": "no-cache", "X-Trace-Id": trace_id}
    return StreamingResponse(closed_when_done(events), media_type="text/event-stream", headers=headers)
