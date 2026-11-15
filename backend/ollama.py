"""Ollama's own API: the models it has, and a chat reply streamed piece by piece.

Its native /api/chat is used rather than the OpenAI-compatible one, because only it takes keep_alive, which unloads the
model after it has been idle for that long.
"""

import json
from collections.abc import Generator
from dataclasses import dataclass

import httpx

# Loading a model can take a while, so only connecting is quick; a reply may pause between pieces while it loads
CONNECT_TIMEOUT_SECONDS = 5
READ_TIMEOUT_SECONDS = 300


class OllamaError(Exception):
    """Ollama is unreachable or refused; the message is safe to show and log, since it never holds the chat."""


@dataclass(frozen=True)
class ModelInfo:
    name: str
    size: int
    parameters: str


@dataclass(frozen=True)
class Piece:
    text: str
    done: bool = False
    tokens: int | None = None


def model_info(raw: object) -> ModelInfo | None:
    if not isinstance(raw, dict) or not isinstance(raw.get("name"), str):
        return None
    details = raw.get("details")
    parameters = details.get("parameter_size", "") if isinstance(details, dict) else ""
    size = raw.get("size")
    return ModelInfo(name=raw["name"], size=size if isinstance(size, int) else 0, parameters=str(parameters))


def piece_of(line: str) -> Piece:
    try:
        data = json.loads(line)
    except ValueError as error:
        raise OllamaError("Ollama sent a reply that is not JSON") from error
    if not isinstance(data, dict):
        raise OllamaError("Ollama sent a reply that is not JSON")
    if "error" in data:
        raise OllamaError(f"Ollama: {data['error']}")
    message = data.get("message")
    text = message.get("content", "") if isinstance(message, dict) else ""
    tokens = data.get("eval_count")
    return Piece(text=str(text), done=bool(data.get("done")), tokens=tokens if isinstance(tokens, int) else None)


def refusal(response: httpx.Response) -> OllamaError:
    response.read()
    try:
        data = response.json()
        detail = data.get("error") if isinstance(data, dict) else None
    except ValueError:
        detail = None
    return OllamaError(f"Ollama: {detail or f'answered {response.status_code}'}")


class OllamaClient:
    def __init__(self, url: str, keep_alive: str | int, transport: httpx.BaseTransport | None = None) -> None:
        self._keep_alive = keep_alive
        timeout = httpx.Timeout(READ_TIMEOUT_SECONDS, connect=CONNECT_TIMEOUT_SECONDS)
        self._http = httpx.Client(base_url=url, timeout=timeout, transport=transport)
        self.url = url

    def models(self) -> list[ModelInfo]:
        try:
            response = self._http.get("/api/tags", timeout=CONNECT_TIMEOUT_SECONDS)
        except httpx.HTTPError as error:
            raise OllamaError(f"Ollama is not reachable at {self.url}; is it running?") from error
        if response.status_code != 200:
            raise refusal(response)
        try:
            listed = response.json().get("models", [])
        except (ValueError, AttributeError) as error:
            raise OllamaError("Ollama sent a model list that is not JSON") from error
        found = [model_info(raw) for raw in listed] if isinstance(listed, list) else []
        return [model for model in found if model is not None]

    def stream_chat(self, model: str, messages: list[dict[str, str]], options: dict[str, float | int]) -> Generator[Piece, None, None]:
        """Closing the iterator closes the connection, which makes Ollama stop writing."""
        body: dict[str, object] = {"model": model, "messages": messages, "stream": True, "keep_alive": self._keep_alive}
        if options:
            body["options"] = options
        try:
            with self._http.stream("POST", "/api/chat", json=body) as response:
                if response.status_code != 200:
                    raise refusal(response)
                for line in response.iter_lines():
                    if line.strip():
                        yield piece_of(line)
        except httpx.HTTPError as error:
            raise OllamaError(f"Ollama stopped answering ({type(error).__name__})") from error

    def close(self) -> None:
        self._http.close()
