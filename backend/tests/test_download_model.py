from pathlib import Path

import pytest

import download_model
from download_model import DownloadError, download
from settings import CHECKPOINT_FILES, checkpoint_complete


def write_checkpoint(path: Path, names: tuple[str, ...] = CHECKPOINT_FILES) -> None:
    for name in names:
        (path / name).parent.mkdir(parents=True, exist_ok=True)
        (path / name).write_text("x")


class FakeHub:
    def __init__(self, writes: tuple[str, ...] = CHECKPOINT_FILES, fails: Exception | None = None) -> None:
        self.writes = writes
        self.fails = fails
        self.calls: list[dict[str, object]] = []

    def __call__(self, **kwargs: object) -> str:
        self.calls.append(kwargs)
        if self.fails is not None:
            raise self.fails
        write_checkpoint(Path(str(kwargs["local_dir"])), self.writes)
        return str(kwargs["local_dir"])


def test_downloads_only_the_english_checkpoint(tmp_path: Path) -> None:
    hub = FakeHub()
    target = tmp_path / "models" / "laya"

    assert download(target, hub) is True
    assert checkpoint_complete(target)
    assert hub.calls == [{"repo_id": "convaiinnovations/laya", "local_dir": target, "allow_patterns": download_model.PATTERNS}]


def test_leaves_a_complete_checkpoint_alone(tmp_path: Path) -> None:
    write_checkpoint(tmp_path)
    hub = FakeHub()

    assert download(tmp_path, hub) is False
    assert hub.calls == []


def test_finishes_a_download_that_stopped_part_way(tmp_path: Path) -> None:
    write_checkpoint(tmp_path, ("rl_agent_config.json",))
    hub = FakeHub()

    assert download(tmp_path, hub) is True
    assert len(hub.calls) == 1


def test_a_failed_download_is_reported_and_not_counted_as_found(tmp_path: Path) -> None:
    hub = FakeHub(fails=ConnectionError("network unreachable"))

    with pytest.raises(DownloadError, match="ConnectionError: network unreachable"):
        download(tmp_path, hub)
    assert not checkpoint_complete(tmp_path)


def test_a_download_missing_files_is_reported(tmp_path: Path) -> None:
    hub = FakeHub(writes=("rl_agent_config.json", "model.safetensors"))

    with pytest.raises(DownloadError, match="tokenizer/tokenizer.json"):
        download(tmp_path, hub)


def test_refuses_without_enough_free_space(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(download_model, "free_bytes", lambda path: 500_000_000)
    hub = FakeHub()

    with pytest.raises(DownloadError, match="1 GB free"):
        download(tmp_path / "laya", hub)
    assert hub.calls == []
