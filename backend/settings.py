"""Settings from .env at the project root; a missing or invalid value falls back to its default, with a warning."""

import logging
import os
import re
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MODEL_PATH = "../z-image-inference/models/laya"
CHECKPOINT_FILE = "rl_agent_config.json"
DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434"
DEFAULT_OLLAMA_KEEP_ALIVE = "5m"
# What Ollama's keep_alive takes: seconds, or a duration such as 30s, 5m or 1h; a negative value keeps it loaded
DURATION = re.compile(r"-?\d+(\.\d+)?(ms|s|m|h)?")

log = logging.getLogger("settings")


def whole_number(name: str, default: int) -> int:
    text = os.environ.get(name, "").strip()
    if not text:
        return default
    if text.isdigit():
        return int(text)
    log.warning("%s=%r is not a whole number; using %d.", name, text, default)
    return default


def ollama_keep_alive() -> str | int:
    """A number without a unit is seconds; Ollama reads a bare string such as "300" as nanoseconds, so it is sent as a number."""
    text = os.environ.get("OLLAMA_KEEP_ALIVE", "").strip()
    if not text:
        return DEFAULT_OLLAMA_KEEP_ALIVE
    if not DURATION.fullmatch(text):
        log.warning("OLLAMA_KEEP_ALIVE=%r is not a duration such as 300 or 5m; using %s.", text, DEFAULT_OLLAMA_KEEP_ALIVE)
        return DEFAULT_OLLAMA_KEEP_ALIVE
    return int(text) if text.lstrip("-").isdigit() else text


@dataclass(frozen=True)
class Settings:
    model_path: Path
    keep_alive: int
    threads: int
    ollama_url: str
    ollama_keep_alive: str | int

    @property
    def model_found(self) -> bool:
        return (self.model_path / CHECKPOINT_FILE).is_file()


def load_settings() -> Settings:
    load_dotenv(ROOT / ".env")
    path = Path(os.environ.get("LAYA_MODEL_PATH", "").strip() or DEFAULT_MODEL_PATH).expanduser()
    return Settings(
        model_path=(ROOT / path).resolve(),
        keep_alive=whole_number("LAYA_KEEP_ALIVE", 300),
        threads=max(1, whole_number("LAYA_THREADS", 8)),
        ollama_url=(os.environ.get("OLLAMA_URL", "").strip() or DEFAULT_OLLAMA_URL).rstrip("/"),
        ollama_keep_alive=ollama_keep_alive(),
    )
