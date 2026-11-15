.PHONY: help setup model build app api ui test lint check

help: ## List the targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-8s %s\n", $$1, $$2}'

setup: ## Check the tools, install everything, create .env once, download the models and build the UI (safe to rerun)
	scripts/setup.sh

model: ## Download Laya to LAYA_MODEL_PATH if it is not there yet
	uv run python backend/download_model.py

build: ## Build the UI the server serves
	cd frontend && npm run build

app: build ## Build the UI and run everything at http://127.0.0.1:8100
	uv run python backend/app.py

api: ## Run the server only (port 8100)
	uv run python backend/app.py

ui: ## Run the UI with live reload at http://127.0.0.1:5174 (needs `make api`)
	cd frontend && npm run dev

test: ## Backend and UI tests
	uv run pytest
	cd frontend && npm test

lint: ## Type-check both sides
	uv run mypy backend
	cd frontend && npm run typecheck

check: lint test ## Everything, before a commit
