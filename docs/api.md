# API

The UI uses only these endpoints, so scripts can use them the same way.

## `POST /api/ask` (Decide)

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

## `POST /api/chat` (Chat)

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

---

See also: [Architecture](architecture.md) · [Usage](usage.md) · [Back to the README](../README.md)
