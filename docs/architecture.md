# How it works

The two models, and how a request travels from the browser to a model and back.

## The two models

| | Laya (Decide) | Chat model (Chat) |
|---|---|---|
| What it does | Picks an answer from options you give; it never writes text | Writes a reply to a conversation |
| Model | `convaiinnovations/laya`, English checkpoint, 421M parameters | Any Ollama model; by default Gemma 3 4B abliterated (uncensored), 4-bit |
| Runs | On the CPU, in a child process the server starts and ends | In Ollama, which uses the GPU where it can |
| Unloads | `LAYA_KEEP_ALIVE` seconds after the last question (300) | `OLLAMA_KEEP_ALIVE` after the last reply (5 minutes) |
| First answer | About 2 s while it loads (longer the first time after a reboot), then about 0.1 to 0.3 s per question | About 5 to 10 s while it loads, then the words stream straight away |

## Request flow

```
Browser (React)                   FastAPI server, port 8100                   Models
───────────────                   ─────────────────────────                   ──────
Decide tab ── POST /api/ask ───▶  questions.py  check the request
             ◀── SSE events ───   decide.py     one event per answer   ───▶  laya_runner.py
                                                                             └─ worker.py (child process, CPU)
Chat tab ──── POST /api/chat ──▶  chat.py       check the messages
             ◀── SSE events ───                 one event per piece    ───▶  ollama.py ─▶ Ollama /api/chat
             ─── GET /api/models ─────────────────────────────────────────▶  Ollama /api/tags
```

- **Streaming.** Both endpoints answer with [Server-Sent Events](https://developer.mozilla.org/docs/Web/API/Server-sent_events). The UI reads them with `fetch` and a stream reader (`frontend/src/lib/sse.ts`) rather than `EventSource`, because the requests are POSTs with a JSON body.
- **Laya in a child process.** `laya_runner.py` starts `worker.py`, which loads the checkpoint and answers JSON lines on stdin and stdout. One request uses Laya at a time; the others wait. Unloading ends the process, which gives all its memory back (unloading inside the server would leave about 0.8 GB behind). Laya runs on the CPU, where loading takes about 2 s; on the GPU every fresh load would first spend about 13 s compiling kernels.
- **Ollama's own API.** `ollama.py` uses Ollama's native `/api/chat`, not its OpenAI-compatible one, because only the native one takes `keep_alive`, which unloads the model when idle.
- **Stopping.** When the browser stops a stream (Stop, a new question, closing the tab), `events.py` closes the stream on the server too: Laya's turn ends and its lock is released, and the connection to Ollama closes, which makes Ollama stop writing.
- **Checks.** Every request is checked before a model is used (types, sizes, limits, a model Ollama really has), so an invalid one is refused with `422` without loading anything.
- **Logs.** The terminal and `logs/app.log` (rotated at 5 MB, three kept) get one line per request with a trace id, the model, counts and timings, never the text, questions, messages or replies. A failure's trace id is also shown in the UI, so it can be found in the log.

---

See also: [API](api.md) · [Development](development.md) · [Configuration](configuration.md) · [Back to the README](../README.md)
