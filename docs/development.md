# Development

How to work on the playground: commands, layout, conventions and common changes.

## Commands

| Command | Does |
|---|---|
| `make setup` | Sets everything up (see [Setup](setup.md)); safe to rerun |
| `make model` | Downloads Laya to `LAYA_MODEL_PATH` if missing |
| `make app` | Builds the UI and runs the server on port 8100 |
| `make api` | Runs the server only |
| `make ui` | Runs the UI with live reload on port 5174, proxying `/api` to `make api` |
| `make test` | Backend tests (pytest) and UI tests (Vitest) |
| `make lint` | Type checks: mypy (strict) and TypeScript |
| `make check` | Lint and tests; run it before every commit |

During development, run `make api` and `make ui` in two terminals and open http://127.0.0.1:5174; UI changes appear as you save, and backend changes need `make api` restarted.

## Layout

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

## Conventions

- **Colours.** Use the theme's colour names (`bg-surface`, `text-muted`, `border-line`, `bg-accent` …), defined once in `frontend/src/index.css` with a light and a dark value, never raw Tailwind greys, so both themes stay in step. Text meets WCAG AA contrast in both themes; check a new colour pair before using it.
- **Controls.** Build with the shared controls in `components/ui/` so every button, field and switch looks and behaves the same (focus ring, 44 px touch targets on phones, arrow keys in segmented controls).
- **States.** Data that loads shows a placeholder while pending, an error with Retry when it fails, and its empty state only once settled.
- **Motion.** Animate with `motion-safe:` so Reduce motion turns it off.
- **Privacy.** Never log text, questions, messages or replies; log the trace id, counts and timings.
- **Checks.** Validate every request on the server, before any model is used.
- **Types.** Python is type-hinted and checked with `mypy --strict`; the UI is strict TypeScript with no `any`.

## Common changes

- **A question template:** add it to `TEMPLATES` in `frontend/src/lib/questions.ts`.
- **A chat setting:** add the field to `ChatOptions` in `backend/chat.py` (with its range and its Ollama option name in `for_ollama`), to `ChatSettings` and `chatBody` in `frontend/src/lib/chat.ts`, and a field in `ChatSettingsPanel.tsx`.
- **A new streamed endpoint:** write a generator of `event(...)` strings and return it with `event_stream(...)` from `backend/events.py`, which also closes it when the client leaves; read it in the UI with `postEvents` from `frontend/src/lib/sse.ts`.
- **A setting in `.env`:** read it in `backend/settings.py` with a default and a warning for invalid values, and list it in `.env.example` and the table in [Configuration](configuration.md).

## The banner

`docs/images/banner.svg` is the source of the README banner. After editing it, render `banner.jpg` with headless Chrome (2880 × 1800):

```bash
cd docs/images
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --hide-scrollbars \
  --window-size=1440,900 --force-device-scale-factor=2 --screenshot=banner.png "file://$PWD/banner.svg"
sips -s format jpeg -s formatOptions 88 banner.png --out banner.jpg && rm banner.png
```

---

See also: [Architecture](architecture.md) · [API](api.md) · [Configuration](configuration.md) · [Back to the README](../README.md)
