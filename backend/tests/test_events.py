import asyncio
import threading
from collections.abc import Generator

from events import closed_when_done


def test_a_stream_the_client_leaves_part_way_is_still_closed() -> None:
    cleaned = threading.Event()

    def stream() -> Generator[str, None, None]:
        try:
            yield "first"
            yield "second"
        finally:
            cleaned.set()

    async def leave_after_first() -> list[str]:
        events = closed_when_done(stream())
        received = [await anext(events)]
        await events.aclose()  # What a disconnect does to the response
        return received

    assert asyncio.run(leave_after_first()) == ["first"]
    assert cleaned.wait(timeout=2)


def test_a_finished_stream_yields_every_event() -> None:
    async def read_all() -> list[str]:
        return [chunk async for chunk in closed_when_done(iter_events())]

    def iter_events() -> Generator[str, None, None]:
        yield from ("a", "b", "c")

    assert asyncio.run(read_all()) == ["a", "b", "c"]
