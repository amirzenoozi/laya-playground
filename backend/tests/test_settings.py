from pathlib import Path

import pytest

from settings import ROOT, load_settings


@pytest.fixture(autouse=True)
def clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("settings.load_dotenv", lambda path: None)
    for name in ("LAYA_MODEL_PATH", "LAYA_KEEP_ALIVE", "LAYA_THREADS"):
        monkeypatch.delenv(name, raising=False)


def test_defaults_to_the_copy_z_image_already_has() -> None:
    settings = load_settings()

    assert settings.model_path == (ROOT / "../z-image-inference/models/laya").resolve()
    assert settings.keep_alive == 300
    assert settings.threads == 8


def test_reads_the_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("LAYA_MODEL_PATH", str(tmp_path))
    monkeypatch.setenv("LAYA_KEEP_ALIVE", "0")
    monkeypatch.setenv("LAYA_THREADS", "4")
    settings = load_settings()

    assert (settings.model_path, settings.keep_alive, settings.threads) == (tmp_path, 0, 4)


def test_an_invalid_number_falls_back_to_its_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LAYA_KEEP_ALIVE", "5m")
    monkeypatch.setenv("LAYA_THREADS", "0")

    settings = load_settings()

    assert settings.keep_alive == 300
    assert settings.threads == 1
