"""Settings from .env at the project root; a missing or invalid value falls back to its default, with a warning."""

import logging
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MODEL_PATH = "../z-image-inference/models/laya"
CHECKPOINT_FILE = "rl_agent_config.json"

log = logging.getLogger("settings")


def whole_number(name: str, default: int) -> int:
    text = os.environ.get(name, "").strip()
    if not text:
        return default
    if text.isdigit():
        return int(text)
    log.warning("%s=%r is not a whole number; using %d.", name, text, default)
    return default


@dataclass(frozen=True)
class Settings:
    model_path: Path
    keep_alive: int
    threads: int

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
    )
