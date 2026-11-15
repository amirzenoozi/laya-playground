# Laya playground

Ask [Laya](https://huggingface.co/convaiinnovations/laya), a small decision model, typed questions about a text and watch the answers arrive one by one.

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

The model is **not downloaded**: `LAYA_MODEL_PATH` in `.env` points at an existing checkpoint, by default the copy in `../z-image-inference/models/laya`.

| Variable | Default | Meaning |
|---|---|---|
| `LAYA_MODEL_PATH` | `../z-image-inference/models/laya` | The checkpoint folder (`rl_agent_config.json`, `model.safetensors`, `tokenizer/`, `encoder/`); relative paths start at the project root |
| `LAYA_KEEP_ALIVE` | `300` | Seconds Laya stays loaded after the last question; `0` unloads it after each request |
| `LAYA_THREADS` | `8` | CPU threads Laya uses |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING` or `ERROR` |

## Development

```bash
make api     # the server on port 8100
make ui      # the UI with live reload on port 5174, proxying /api to the server
make check   # type checks and tests on both sides
```

## How it works

- **Backend** (`backend/`, FastAPI): `app.py` serves the API and the built UI; `questions.py` checks the request, puts each question to Laya in its own format and reads every answer into one shape; `laya_runner.py` keeps Laya in a child process (`worker.py`) on the CPU, one request at a time, and ends the process `LAYA_KEEP_ALIVE` seconds after the last request, which gives all its memory back.
- **Frontend** (`frontend/`, React, TypeScript, Tailwind): the question builder on the left, the answers on the right; the last text and questions are remembered in the browser.
- **Logs** go to the terminal and `logs/app.log`, with a trace id, counts and timings, never the text or the questions.

## API

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
