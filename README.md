# Laya playground

A local playground for two kinds of model, each in its own tab:

- **Decide** asks [Laya](https://huggingface.co/convaiinnovations/laya), a small decision model, typed questions about a text, and shows each answer as soon as it is given.
- **Chat** talks with a local language model through [Ollama](https://ollama.com), with the reply streamed word by word.

Everything runs on your own machine. Nothing is sent to an outside service, and nothing you type is saved on the server or written to its logs.

## Quick start

You need macOS or Linux, [uv](https://docs.astral.sh/uv/) and Node.js 20 or newer. Ollama is optional; without it, only the Chat tab is unavailable.

```bash
make setup   # checks the tools, installs everything, creates .env, downloads the models, builds the UI
make app     # starts the app at http://127.0.0.1:8100
```

`make setup` runs `scripts/setup.sh`, which is safe to run again at any time; each step skips what is already done:

| Step | What it does |
|---|---|
| Tools | Checks for macOS or Linux, `uv` and Node.js 20+, and says how to install anything missing |
| Dependencies | `uv sync` (Python) and `npm ci` (UI) |
| Settings | Copies `.env.example` to `.env` the first time; an existing `.env` is never changed |
| Laya | Downloads Laya's English checkpoint (about 807 MB) to `LAYA_MODEL_PATH`, unless a complete copy is there; also `make model` |
| Chat model | If Ollama is installed and running, pulls `hf.co/mlabonne/gemma-3-4b-it-abliterated-GGUF:Q4_K_M` (2.5 GB) unless Ollama has it |
| UI | Builds the UI, which the server then serves |

Pull a different chat model with `CHAT_MODEL=<name> make setup` (any name `ollama pull` accepts), or none with `CHAT_MODEL=none make setup`. The Chat tab lists every model Ollama has, so models pulled later with `ollama pull` appear by themselves.

Already have Laya somewhere else? Point `LAYA_MODEL_PATH` in `.env` at it (for example `../z-image-inference/models/laya`) and nothing is downloaded.

## The two models

| | Laya (Decide) | Chat model (Chat) |
|---|---|---|
| What it does | Picks an answer from options you give; it never writes text | Writes a reply to a conversation |
| Model | `convaiinnovations/laya`, English checkpoint, 421M parameters | Any Ollama model; by default Gemma 3 4B abliterated (uncensored), 4-bit |
| Runs | On the CPU, in a child process the server starts and ends | In Ollama, which uses the GPU where it can |
| Unloads | `LAYA_KEEP_ALIVE` seconds after the last question (300) | `OLLAMA_KEEP_ALIVE` after the last reply (5 minutes) |
| First answer | About 2 s while it loads (longer the first time after a reboot), then about 0.1 to 0.3 s per question | About 5 to 10 s while it loads, then the words stream straight away |

## Using it

### Decide

1. Paste the **text to judge**.
2. Add questions, from scratch or with a **Start from** template (Sentiment, Yes / No check, Urgency, Topic). Each question has a type:

   | Type | You give | Laya answers |
   |---|---|---|
   | Yes / No | the question; optionally what yes and no mean | the probability of yes |
   | Choice | 2 to 20 options | the probability of each option |
   | Score | 2 to 10 levels, lowest first | the probability of each level and the expected level |

   Type an option and press **Enter** to add it; `label: description` adds a hint that helps Laya choose (for example `delivery: shipping, parcels, couriers`). Pasting a list adds one option per line, and Backspace in an empty box removes the last one.
3. Press **Ask** (or ⌘ Enter). The answers appear one by one, each with every option's probability and Laya's confidence. **Stop** cancels; **JSON** shows the request, ready to copy into a script.

Laya answers zero-shot: good option descriptions matter more than the wording of the question, and its confidence is a rough guide rather than a calibrated probability.

### Chat

Pick a model, type a message and press **Enter** (Shift Enter for a new line). Under **System prompt and options** you can set a system prompt, the temperature (0 to 2) and a maximum number of tokens; empty fields use the model's defaults. **Stop** keeps what was written so far, **Regenerate** replaces the last reply, **Copy** copies a reply and **New chat** starts over.

The messages go to the model exactly as you send them: the app adds no system prompt of its own and filters nothing.

### Everywhere

- The theme switch at the top right picks System, Light or Dark; System follows the OS as it changes.
- Each tab remembers its last state in your browser (the questions, the conversation, the settings), so a reload loses nothing. Clearing the site's data clears them.
- Switching tabs never interrupts a running answer or reply.

## How it works

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

## Configuration

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

## API

The UI uses only these endpoints, so scripts can use them the same way.

### `POST /api/ask` (Decide)

```bash
curl -N http://127.0.0.1:8100/api/ask -H 'Content-Type: application/json' -d '{
  "text": "The parcel arrived broken and nobody answers my emails.",
  "questions": [
    {"type": "noul", "instruction": "Is the writer unhappy?", "yes": "they complain"},
    {"type": "choice", "instruction": "What is it about?", "options": [{"label": "billing"}, {"label": "delivery", "description": "shipping, parcels"}]},
    {"type": "score", "instruction": "How angry is the writer?", "levels": ["calm", "annoyed", "furious"]}
  ]}'
```

`text` is up to 10,000 characters, with 1 to 10 questions. A Yes / No question (`noul`) may say what `yes` and `no` mean; option labels and levels must be distinct.

| Event | Data | When |
|---|---|---|
| `status` | `{"state": "loading"}`, then `{"state": "ready", "load_ms"}` | Only when Laya was not loaded |
| `answer` | `{"index", "winner", "probabilities": [{"label", "probability"}], "confidence", "score", "ms"}` | One per question, as soon as it is answered; `score` (the expected level, from 0) for Score questions only |
| `done` | `{"total_ms"}` | After the last answer |
| `error` | `{"message", "trace_id"}` | Laya failed; the stream ends |

Missing model files answer `503`. `GET /api/status` reports `model_found`, `loaded` and `keep_alive`.

### `POST /api/chat` (Chat)

```bash
curl -N http://127.0.0.1:8100/api/chat -H 'Content-Type: application/json' -d '{
  "model": "hf.co/mlabonne/gemma-3-4b-it-abliterated-GGUF:Q4_K_M",
  "messages": [{"role": "system", "content": "Be brief."}, {"role": "user", "content": "Give me three names for a quiet garden."}],
  "options": {"temperature": 0.7, "max_tokens": 200}}'
```

Roles are `system` (first message only), `user` and `assistant`, and the last message must be the user's: up to 100 messages of 20,000 characters each, 200,000 in total. `options` is optional: `temperature` 0 to 2 and `max_tokens` 1 to 8192.

| Event | Data | When |
|---|---|---|
| `token` | `{"text"}` | Each piece of the reply, as it is written |
| `done` | `{"first_token_ms", "total_ms", "tokens"}` | After the last piece |
| `error` | `{"message", "trace_id"}` | Ollama failed; the stream ends |

A model Ollama does not have answers `404`, and Ollama not running `503`. `GET /api/models` lists Ollama's models (`name`, `size` in bytes, `parameters`).

Every stream carries its trace id in the `X-Trace-Id` header.

## Development

### Commands

| Command | Does |
|---|---|
| `make setup` | Everything above; safe to rerun |
| `make model` | Downloads Laya to `LAYA_MODEL_PATH` if missing |
| `make app` | Builds the UI and runs the server on port 8100 |
| `make api` | Runs the server only |
| `make ui` | Runs the UI with live reload on port 5174, proxying `/api` to `make api` |
| `make test` | Backend tests (pytest) and UI tests (Vitest) |
| `make lint` | Type checks: mypy (strict) and TypeScript |
| `make check` | Lint and tests; run it before every commit |

During development, run `make api` and `make ui` in two terminals and open http://127.0.0.1:5174; UI changes appear as you save, and backend changes need `make api` restarted.

### Layout

```
backend/
  app.py              the FastAPI app: routes, logging, serving the built UI
  settings.py         .env settings and the checkpoint's required files
  questions.py        Decide's request, how each question is put to Laya, and how answers are read
  decide.py           Laya's answers as events
  laya_runner.py      keeps Laya loaded only while used; one request at a time
  worker.py           the child process that runs Laya
  chat.py             Chat's request and the reply as events
  ollama.py           Ollama's model list and streamed chat
  events.py           Server-Sent Events, and closing a stream the client stops
  download_model.py   downloads Laya (make model)
  tests/              pytest; Laya and Ollama are faked, so tests load no model and need no network
frontend/src/
  App.tsx             the top bar, the tabs and the theme switch
  components/         DecidePage, ChatPage and their parts
  components/ui/      the shared controls: Button, IconButton, SegmentedControl, Card, Badge, Alert, Skeleton
  lib/                logic without UI: requests and streams (sse, laya, chat), state (useAsk, useChat), storage, theme
  index.css           the theme's colours
scripts/setup.sh      the setup script
```

### Conventions

- **Colours.** Use the theme's colour names (`bg-surface`, `text-muted`, `border-line`, `bg-accent` …), defined once in `frontend/src/index.css` with a light and a dark value, never raw Tailwind greys, so both themes stay in step. Text meets WCAG AA contrast in both themes; check a new colour pair before using it.
- **Controls.** Build with the shared controls in `components/ui/` so every button, field and switch looks and behaves the same (focus ring, 44 px touch targets on phones, arrow keys in segmented controls).
- **States.** Data that loads shows a placeholder while pending, an error with Retry when it fails, and its empty state only once settled.
- **Motion.** Animate with `motion-safe:` so Reduce motion turns it off.
- **Privacy.** Never log text, questions, messages or replies; log the trace id, counts and timings.
- **Checks.** Validate every request on the server, before any model is used.
- **Types.** Python is type-hinted and checked with `mypy --strict`; the UI is strict TypeScript with no `any`.

### Common changes

- **A question template:** add it to `TEMPLATES` in `frontend/src/lib/questions.ts`.
- **A chat setting:** add the field to `ChatOptions` in `backend/chat.py` (with its range and its Ollama option name in `for_ollama`), to `ChatSettings` and `chatBody` in `frontend/src/lib/chat.ts`, and a field in `ChatSettingsPanel.tsx`.
- **A new streamed endpoint:** write a generator of `event(...)` strings and return it with `event_stream(...)` from `backend/events.py`, which also closes it when the client leaves; read it in the UI with `postEvents` from `frontend/src/lib/sse.ts`.
- **A setting in `.env`:** read it in `backend/settings.py` with a default and a warning for invalid values, and list it in `.env.example` and the table above.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Model files missing" on Decide | Run `make model`, or set `LAYA_MODEL_PATH` in `.env` to a folder holding the checkpoint |
| "Ollama is not reachable" on Chat | Start Ollama (`brew services start ollama`, or `ollama serve`), then press Retry |
| "Ollama has no models yet" | `ollama pull <model>` or `make setup`, then reload |
| The first answer or reply is slow | The model is loading; later ones are fast until it unloads. Raise `LAYA_KEEP_ALIVE` or `OLLAMA_KEEP_ALIVE` to keep it loaded longer, at the cost of memory |
| `make app` says the port is in use | Another copy is running; stop it, or find it with `lsof -i :8100` |
| The page looks old after an update | Run `make build` (or `make app`) and reload the page |
| Something failed with a trace id | Search `logs/app.log` for that id |
