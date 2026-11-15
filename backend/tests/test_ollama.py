import httpx

from ollama import OllamaClient


def test_closing_the_reply_closes_the_connection_to_ollama() -> None:
    class Body(httpx.SyncByteStream):
        closed = False

        def __iter__(self):  # type: ignore[no-untyped-def]
            yield b'{"message": {"content": "Fern"}, "done": false}\n'
            yield b'{"message": {"content": " Moss"}, "done": false}\n'

        def close(self) -> None:
            Body.closed = True

    client = OllamaClient("http://ollama", "5m", transport=httpx.MockTransport(lambda request: httpx.Response(200, stream=Body())))
    pieces = client.stream_chat("model", [{"role": "user", "content": "Hi"}], {})

    assert next(pieces).text == "Fern"
    pieces.close()

    assert Body.closed
