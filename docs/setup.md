# Setup

How to install the playground and its two models.

You need macOS or Linux, [uv](https://docs.astral.sh/uv/) and Node.js 20 or newer. Ollama is optional; without it, only the Chat tab is unavailable.

```bash
make setup   # checks the tools, installs everything, creates .env, downloads the models, builds the UI
make app     # starts the app at http://127.0.0.1:8100
```

## What `make setup` does

`make setup` runs `scripts/setup.sh`, which is safe to run again at any time; each step skips what is already done:

| Step | What it does |
|---|---|
| Tools | Checks for macOS or Linux, `uv` and Node.js 20+, and says how to install anything missing |
| Dependencies | `uv sync` (Python) and `npm ci` (UI) |
| Settings | Copies `.env.example` to `.env` the first time; an existing `.env` is never changed |
| Laya | Downloads Laya's English checkpoint (about 807 MB) to `LAYA_MODEL_PATH`, unless a complete copy is there; also `make model` |
| Chat model | If Ollama is installed and running, pulls `hf.co/mlabonne/gemma-3-4b-it-abliterated-GGUF:Q4_K_M` (2.5 GB) unless Ollama has it |
| UI | Builds the UI, which the server then serves |

## The chat model

Pull a different chat model with `CHAT_MODEL=<name> make setup` (any name `ollama pull` accepts), or none with `CHAT_MODEL=none make setup`. The Chat tab lists every model Ollama has, so models pulled later with `ollama pull` appear by themselves.

## Reusing a Laya copy

If Laya is already on your machine, for example from another project, point `LAYA_MODEL_PATH` in `.env` at it (such as `../z-image-inference/models/laya`) and nothing is downloaded.

---

See also: [Configuration](configuration.md) · [Usage](usage.md) · [Troubleshooting](troubleshooting.md) · [Back to the README](../README.md)
