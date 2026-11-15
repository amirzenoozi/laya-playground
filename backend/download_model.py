"""Downloads Laya's English checkpoint to LAYA_MODEL_PATH, unless a complete copy is already there.

Usage: uv run python backend/download_model.py (or `make model`; `make setup` runs it too). Safe to rerun: a complete
checkpoint is left alone, and a download that stopped part way is finished on the next run. Exits non-zero on failure.
"""

import shutil
import sys
from collections.abc import Callable
from pathlib import Path

from settings import CHECKPOINT_FILES, checkpoint_complete, load_settings

REPO = "convaiinnovations/laya"
# The English checkpoint at the repo's root only; the repo also holds two others
PATTERNS = ["rl_agent_config.json", "model.safetensors", "tokenizer/*", "encoder/*"]
NEEDED_BYTES = 1_000_000_000

Fetch = Callable[..., object]


class DownloadError(Exception):
    pass


def free_bytes(path: Path) -> int:
    existing = next(parent for parent in (path, *path.parents) if parent.exists())
    return shutil.disk_usage(existing).free


def download(path: Path, fetch: Fetch) -> bool:
    """Returns True when it downloaded, False when a complete checkpoint was already there."""
    if checkpoint_complete(path):
        return False
    if free_bytes(path) < NEEDED_BYTES:
        raise DownloadError(f"Laya needs about 1 GB free next to {path}; free some space and run it again.")
    path.mkdir(parents=True, exist_ok=True)
    try:
        fetch(repo_id=REPO, local_dir=path, allow_patterns=PATTERNS)
    except Exception as error:  # Network, Hugging Face or disk errors all end the same way: report and retry later
        raise DownloadError(f"Could not download Laya from Hugging Face ({type(error).__name__}: {error}).") from error
    missing = [name for name in CHECKPOINT_FILES if not (path / name).is_file()]
    if missing:
        raise DownloadError(f"The download finished without {', '.join(missing)}.")
    return True


def main() -> int:
    from huggingface_hub import snapshot_download

    path = load_settings().model_path
    try:
        downloaded = download(path, snapshot_download)
    except DownloadError as error:
        print(f"Laya: {error}", file=sys.stderr)
        return 1
    print(f"Laya: {'downloaded to' if downloaded else 'already in'} {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
