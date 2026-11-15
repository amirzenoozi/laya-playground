#!/usr/bin/env bash
# Sets up the Laya playground: checks the tools, installs the dependencies, creates .env once, downloads Laya,
# pulls a chat model into Ollama and builds the UI. Safe to rerun: every step skips what is already done.
#
#   CHAT_MODEL=<name> scripts/setup.sh   pull another chat model (any name `ollama pull` takes)
#   CHAT_MODEL=none scripts/setup.sh     pull no chat model
set -euo pipefail

cd "$(dirname "$0")/.."

DEFAULT_CHAT_MODEL="hf.co/mlabonne/gemma-3-4b-it-abliterated-GGUF:Q4_K_M"
CHAT_MODEL="${CHAT_MODEL:-$DEFAULT_CHAT_MODEL}"

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
warn() { printf '\033[33m!   %s\033[0m\n' "$1"; }
fail() { printf '\033[31mx   %s\033[0m\n' "$1" >&2; exit 1; }

step "Checking the tools"
case "$(uname -s)" in Darwin|Linux) ;; *) fail "macOS or Linux is needed." ;; esac
command -v uv >/dev/null || fail "uv is missing: https://docs.astral.sh/uv/getting-started/installation/ (or: brew install uv)"
command -v node >/dev/null || fail "Node.js 20 or newer is missing: https://nodejs.org (or: brew install node)"
node_major="$(node -p 'process.versions.node.split(".")[0]')"
[ "$node_major" -ge 20 ] || fail "Node.js 20 or newer is needed; this is $(node -v)."
echo "uv $(uv --version | cut -d' ' -f2), Node.js $(node -v)"

step "Installing the dependencies"
uv sync
(cd frontend && npm ci --no-audit --no-fund)

step "Settings"
if [ -f .env ]; then
  echo ".env already exists; leaving it as it is."
else
  cp .env.example .env
  echo "Created .env from .env.example."
fi

step "Laya, the decision model (about 807 MB)"
uv run python backend/download_model.py

step "Chat model in Ollama"
ollama_url="$(grep -E '^OLLAMA_URL=' .env | tail -1 | cut -d= -f2- || true)"
ollama_url="${ollama_url:-http://127.0.0.1:11434}"
if [ "$CHAT_MODEL" = "none" ]; then
  echo "Skipped (CHAT_MODEL=none)."
elif ! command -v ollama >/dev/null; then
  warn "Ollama is not installed, so the Chat tab will not work: https://ollama.com/download (or: brew install ollama)"
elif ! curl -sf "$ollama_url/api/tags" >/dev/null; then
  warn "Ollama is not running at $ollama_url; start it (brew services start ollama) and rerun to pull $CHAT_MODEL."
elif ollama list | awk 'NR > 1 {print $1}' | grep -qxF "$CHAT_MODEL"; then
  echo "$CHAT_MODEL is already in Ollama."
else
  echo "Pulling $CHAT_MODEL…"
  ollama pull "$CHAT_MODEL" || warn "Could not pull $CHAT_MODEL; the Chat tab lists whatever models Ollama has."
fi

step "Building the UI"
(cd frontend && npm run build)

printf '\n\033[32mReady.\033[0m Start it with \033[1mmake app\033[0m and open http://127.0.0.1:8100\n'
