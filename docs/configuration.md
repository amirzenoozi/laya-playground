# Configuration

The settings in `.env`.

All settings live in `.env` (created from `.env.example`); an invalid value falls back to its default with a warning in the log.

| Variable | Default | Meaning |
|---|---|---|
| `LAYA_MODEL_PATH` | `models/laya` | The Laya checkpoint folder; a relative path starts at the project root |
| `LAYA_KEEP_ALIVE` | `300` | Seconds Laya stays loaded after the last question; `0` unloads it after each request |
| `LAYA_THREADS` | `8` | CPU threads Laya uses |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Where Ollama listens |
| `OLLAMA_KEEP_ALIVE` | `5m` | How long a chat model stays loaded after the last reply: seconds (`300`) or a duration (`30s`, `5m`, `1h`); negative keeps it loaded |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING` or `ERROR` |

The server listens on `127.0.0.1:8100` only, so it is not reachable from other machines.

---

See also: [Setup](setup.md) · [Architecture](architecture.md) · [Back to the README](../README.md)
