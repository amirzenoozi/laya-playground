# Troubleshooting

Common problems and their fixes.

| Problem | Fix |
|---|---|
| "Model files missing" on Decide | Run `make model`, or set `LAYA_MODEL_PATH` in `.env` to a folder holding the checkpoint |
| "Ollama is not reachable" on Chat | Start Ollama (`brew services start ollama`, or `ollama serve`), then press Retry |
| "Ollama has no models yet" | `ollama pull <model>` or `make setup`, then reload |
| The first answer or reply is slow | The model is loading; later ones are fast until it unloads. Raise `LAYA_KEEP_ALIVE` or `OLLAMA_KEEP_ALIVE` to keep it loaded longer, at the cost of memory |
| `make app` says the port is in use | Another copy is running; stop it, or find it with `lsof -i :8100` |
| The page looks old after an update | Run `make build` (or `make app`) and reload the page |
| Something failed with a trace id | Search `logs/app.log` for that id |

---

See also: [Setup](setup.md) · [Configuration](configuration.md) · [Back to the README](../README.md)
