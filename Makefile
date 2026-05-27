.PHONY: help dev seed index test lint format docker-up docker-down migrate

help:
	@echo "MEDICA Development Commands"
	@echo "================================"
	@echo "  make dev          Start backend dev server"
	@echo "  make frontend     Start frontend dev server"
	@echo "  make docker-up    Start full stack (Docker)"
	@echo "  make docker-down  Stop Docker stack"
	@echo "  make migrate      Run database migrations"
	@echo "  make seed         Seed initial knowledge base from PubMed"
	@echo "  make index        Rebuild all indexes"
	@echo "  make test         Run tests"
	@echo "  make lint         Run linters"
	@echo "  make format       Format code"

dev:
	cd backend && uvicorn api.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

migrate:
	cd backend && alembic upgrade head

seed:
	cd backend && python -m knowledge.seeder

index:
	cd backend && python -m indexing.rebuild

test:
	cd backend && pytest tests/ -v

lint:
	cd backend && ruff check .
	cd frontend && npm run lint

format:
	cd backend && ruff format .
	cd frontend && npm run format

install-backend:
	cd backend && pip install -r requirements.txt

install-frontend:
	cd frontend && npm install

setup: install-backend install-frontend migrate
	@echo "MEDICA setup complete. Run 'make seed' to populate the knowledge base."
