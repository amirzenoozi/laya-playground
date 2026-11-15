"""Keeps Laya loaded only while it is used: one request at a time, unloaded LAYA_KEEP_ALIVE seconds after the last.

Laya runs in a child process (worker.py); unloading ends it, which gives all its memory back.
"""

import json
import logging
import select
import subprocess
import sys
import threading
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Protocol

log = logging.getLogger("laya")

WORKER = Path(__file__).with_name("worker.py")
# Starting Python, importing torch and loading take about 2 seconds; a first start after a reboot can be slower
LOAD_TIMEOUT_SECONDS = 120
ANSWER_TIMEOUT_SECONDS = 30

RawAnswers = dict[str, dict[str, object]]


class LayaError(Exception):
    """Laya could not load or answer; the message is safe to show and log, since it never holds the text."""


class AnswerRejected(LayaError):
    """Laya refused one request; the process is fine and stays loaded."""


class Agent(Protocol):
    def predict(self, text: str, questions: dict[str, dict[str, object]]) -> RawAnswers: ...

    def close(self) -> None: ...


class ProcessAgent:
    """Laya in a child process: requests and answers are JSON lines over its stdin and stdout."""

    def __init__(self, model_path: Path, threads: int) -> None:
        command = [sys.executable, str(WORKER), str(model_path), str(threads)]
        self._process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, bufsize=1)
        try:
            self._reply(LOAD_TIMEOUT_SECONDS)
        except LayaError:
            self.close()
            raise

    def predict(self, text: str, questions: dict[str, dict[str, object]]) -> RawAnswers:
        assert self._process.stdin is not None
        self._process.stdin.write(json.dumps({"text": text, "questions": questions}) + "\n")
        self._process.stdin.flush()
        reply = self._reply(ANSWER_TIMEOUT_SECONDS)
        answers = reply.get("answers")
        if not isinstance(answers, dict):
            raise AnswerRejected(f"Laya could not answer ({reply.get('error', 'no answers')})")
        return answers

    def _reply(self, timeout: float) -> dict[str, object]:
        output = self._process.stdout
        assert output is not None
        ready, _, _ = select.select([output], [], [], timeout)
        if not ready:
            raise LayaError(f"Laya did not answer within {timeout:.0f}s")
        line = output.readline()
        if not line:
            raise LayaError(f"Laya's process ended (exit code {self._process.poll()})")
        reply: dict[str, object] = json.loads(line)
        return reply

    def close(self) -> None:
        if self._process.stdin is not None:
            self._process.stdin.close()
        try:
            self._process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self._process.kill()
            self._process.wait()


class LayaRunner:
    def __init__(self, start: Callable[[], Agent], keep_alive: float) -> None:
        self._start = start
        self._keep_alive = keep_alive
        self._lock = threading.Lock()
        self._agent: Agent | None = None
        # Each turn moves it on, so an unload timer set before a later turn does nothing
        self._turns = 0

    @property
    def loaded(self) -> bool:
        return self._agent is not None

    @contextmanager
    def turn(self) -> Iterator["LayaRunner"]:
        """Holds Laya for one request; others wait. Afterwards the unload timer starts."""
        with self._lock:
            self._turns += 1
            try:
                yield self
            finally:
                self._after_turn(self._turns)

    def load(self) -> None:
        if self._agent is None:
            log.info("Loading Laya.")
            self._agent = self._start()

    def predict(self, text: str, questions: dict[str, dict[str, object]]) -> RawAnswers:
        if self._agent is None:
            raise LayaError("Laya is not loaded")
        try:
            return self._agent.predict(text, questions)
        except AnswerRejected:
            raise
        except LayaError:
            self._close()
            raise

    def _after_turn(self, turn: int) -> None:
        if self._keep_alive <= 0:
            self._close()
            return
        timer = threading.Timer(self._keep_alive, self._unload_if_idle, args=(turn,))
        timer.daemon = True
        timer.start()

    def _unload_if_idle(self, turn: int) -> None:
        with self._lock:
            if turn == self._turns:
                self._close()

    def _close(self) -> None:
        if self._agent is not None:
            self._agent.close()
            self._agent = None
            log.info("Unloaded Laya.")

    def shutdown(self) -> None:
        with self._lock:
            self._close()
