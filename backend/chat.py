"""A chat with one of Ollama's models, as events: `token` ({"text"}) for each piece of the reply as it arrives, then
`done` ({"first_token_ms", "total_ms", "tokens"}) or `error` ({"message", "trace_id"}).

Nothing is added (no system prompt of its own), checked or saved: the messages go to the model as sent. Logs hold the
trace id, model, counts and timings, never the messages.
"""

import logging
import time
from collections.abc import Generator
from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from events import event, milliseconds_since
from ollama import OllamaClient, OllamaError

log = logging.getLogger("chat")

MAX_MESSAGES = 100
MAX_MESSAGE = 20_000
MAX_TOTAL = 200_000


class Role(StrEnum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"


class Message(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Role
    content: Annotated[str, StringConstraints(min_length=1, max_length=MAX_MESSAGE)]


class ChatOptions(BaseModel):
    model_config = ConfigDict(extra="forbid")

    temperature: float | None = Field(default=None, ge=0, le=2)
    max_tokens: int | None = Field(default=None, ge=1, le=8192)

    def for_ollama(self) -> dict[str, float | int]:
        options: dict[str, float | int] = {}
        if self.temperature is not None:
            options["temperature"] = self.temperature
        if self.max_tokens is not None:
            options["num_predict"] = self.max_tokens
        return options


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    messages: list[Message] = Field(min_length=1, max_length=MAX_MESSAGES)
    options: ChatOptions = ChatOptions()

    @model_validator(mode="after")
    def in_order(self) -> "ChatRequest":
        if self.messages[-1].role != Role.USER:
            raise ValueError("the last message must be the user's")
        if any(message.role == Role.SYSTEM for message in self.messages[1:]):
            raise ValueError("only the first message can be a system prompt")
        if sum(len(message.content) for message in self.messages) > MAX_TOTAL:
            raise ValueError(f"the messages are longer than {MAX_TOTAL:,} characters in total")
        return self

    def messages_for_ollama(self) -> list[dict[str, str]]:
        return [{"role": message.role.value, "content": message.content} for message in self.messages]


class Reply:
    """What a reply has produced so far, for the log and the done event."""

    def __init__(self) -> None:
        self.started = time.perf_counter()
        self.first_token_ms: int | None = None
        self.characters = 0
        self.tokens: int | None = None

    def add(self, text: str) -> None:
        if self.first_token_ms is None:
            self.first_token_ms = milliseconds_since(self.started)
        self.characters += len(text)

    def summary(self) -> dict[str, object]:
        return {"first_token_ms": self.first_token_ms, "total_ms": milliseconds_since(self.started), "tokens": self.tokens}


def chat_stream(ollama: OllamaClient, request: ChatRequest, trace_id: str) -> Generator[str, None, None]:
    reply = Reply()
    pieces = ollama.stream_chat(request.model, request.messages_for_ollama(), request.options.for_ollama())
    try:
        for piece in pieces:
            if piece.text:
                reply.add(piece.text)
                yield event("token", {"text": piece.text})
            if piece.done:
                reply.tokens = piece.tokens
    except OllamaError as error:
        log.warning("[%s] Failed after %d characters: %s", trace_id, reply.characters, error)
        yield event("error", {"message": str(error), "trace_id": trace_id})
        return
    except GeneratorExit:
        log.info("[%s] Stopped after %d characters in %d ms.", trace_id, reply.characters, milliseconds_since(reply.started))
        raise
    finally:
        pieces.close()
    log.info("[%s] Answered %d characters (%s tokens) in %d ms.", trace_id, reply.characters, reply.tokens, milliseconds_since(reply.started))
    yield event("done", reply.summary())
