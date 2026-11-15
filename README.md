# Laya playground

Two tabs:

- **Decide**: ask [Laya](https://huggingface.co/convaiinnovations/laya), a small decision model, typed questions about a text and watch the answers arrive one by one.
- **Chat**: chat with the local models [Ollama](https://ollama.com) already has, with the reply streamed word by word.

Laya does not write text: it picks an answer. Each question is one of three types:

| Type | You give | Laya answers |
|---|---|---|
| Yes / No | the question, and optionally what yes and no mean | the probability of yes |
| Choice | the question and 2 to 20 options (`label: optional description`) | the probability of each option |
| Score | the question and 2 to 10 levels, lowest first | the probability of each level and the expected level |

## Setup

Needs macOS or Linux, [uv](https://docs.astral.sh/uv/) and Node.js 20+.

```bash
make setup   # Python and UI dependencies, and .env from .env.example
make app     # build the UI and open http://127.0.0.1:8100
```

Chat needs Ollama running (`brew services start ollama`) with at least one model; the playground lists the ones it has and never pulls one.

Laya is **not downloaded**: `LAYA_MODEL_PATH` in `.env` points at an existing checkpoint, by default the copy in `../z-image-inference/models/laya`.

| Variable | Default | Meaning |
|---|---|---|
| `LAYA_MODEL_PATH` | `../z-image-inference/models/laya` | The checkpoint folder (`rl_agent_config.json`, `model.safetensors`, `tokenizer/`, `encoder/`); relative paths start at the project root |
| `LAYA_KEEP_ALIVE` | `300` | Seconds Laya stays loaded after the last question; `0` unloads it after each request |
| `LAYA_THREADS` | `8` | CPU threads Laya uses |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Where Ollama listens |
| `OLLAMA_KEEP_ALIVE` | `5m` | How long a chat model stays loaded after the last reply: seconds (`300`) or a duration (`30s`, `5m`, `1h`); negative keeps it loaded |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING` or `ERROR` |

## Development

```bash
make api     # the server on port 8100
make ui      # the UI with live reload on port 5174, proxying /api to the server
make check   # type checks and tests on both sides
```

## How it works

- **Backend** (`backend/`, FastAPI): `app.py` serves the API and the built UI; `questions.py` checks the request, puts each question to Laya in its own format and reads every answer into one shape; `laya_runner.py` keeps Laya in a child process (`worker.py`) on the CPU, one request at a time, and ends the process `LAYA_KEEP_ALIVE` seconds after the last request, which gives all its memory back.
- **Chat** (`backend/chat.py`, `backend/ollama.py`): sends the messages to Ollama's own `/api/chat` (the only one that takes `keep_alive`, so the model unloads when idle) exactly as given: no system prompt of its own, no checks, nothing saved.
- **Streams** (`backend/events.py`): both run as Server-Sent Events, and a stream the browser stops is always closed, which releases Laya and makes Ollama stop writing.
- **Frontend** (`frontend/`, React, TypeScript, Tailwind): Decide has the question builder on the left and the answers on the right; Chat has the model, system prompt and options on the left and the conversation on the right. Each tab's last state is remembered in the browser.
- **Logs** go to the terminal and `logs/app.log`, with a trace id, model, counts and timings, never the text, questions, messages or replies.

## API

### Decide

`POST /api/ask` with `{"text": "...", "questions": [...]}` answers with Server-Sent Events:

| Event | Data | When |
|---|---|---|
| `status` | `{"state": "loading"}`, then `{"state": "ready", "load_ms"}` | Only when Laya was not loaded |
| `answer` | `{"index", "winner", "probabilities": [{"label", "probability"}], "confidence", "score", "ms"}` | One per question, as soon as it is answered |
| `done` | `{"total_ms"}` | After the last answer |
| `error` | `{"message", "trace_id"}` | Laya failed; the stream ends |

```bash
curl -N http://127.0.0.1:8100/api/ask -H 'Content-Type: application/json' -d '{
  "text": "The parcel arrived broken and nobody answers my emails.",
  "questions": [
    {"type": "noul", "instruction": "Is the writer unhappy?"},
    {"type": "choice", "instruction": "What is it about?", "options": [{"label": "billing"}, {"label": "delivery", "description": "shipping, parcels"}]},
    {"type": "score", "instruction": "How angry is the writer?", "levels": ["calm", "annoyed", "furious"]}
  ]}'
```

An invalid request answers `422` and missing model files `503`, before Laya loads. `GET /api/status` reports `model_found`, `loaded` and `keep_alive`.

### Chat

`GET /api/models` lists Ollama's models (`name`, `size`, `parameters`); `503` when Ollama is not reachable.

`POST /api/chat` with `{"model": "...", "messages": [{"role", "content"}], "options": {"temperature", "max_tokens"}}` answers with Server-Sent Events:

| Event | Data | When |
|---|---|---|
| `token` | `{"text"}` | Each piece of the reply, as it is written |
| `done` | `{"first_token_ms", "total_ms", "tokens"}` | After the last piece |
| `error` | `{"message", "trace_id"}` | Ollama failed; the stream ends |

Roles are `system` (first message only), `user` and `assistant`, and the last message must be the user's; up to 100 messages of 20,000 characters each, 200,000 in total. `temperature` is 0 to 2 and `max_tokens` 1 to 8192; both are optional. An invalid chat answers `422`, a model Ollama does not have `404` and Ollama not running `503`.

```bash
curl -N http://127.0.0.1:8100/api/chat -H 'Content-Type: application/json' -d '{
  "model": "hf.co/mlabonne/gemma-3-4b-it-abliterated-GGUF:Q4_K_M",
  "messages": [{"role": "system", "content": "Be brief."}, {"role": "user", "content": "Give me three names for a quiet garden."}],
  "options": {"temperature": 0.7}}'
```
