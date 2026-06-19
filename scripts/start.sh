#!/bin/bash
# Production startup: run migrations then start uvicorn.
# PORT and WEB_CONCURRENCY are set by the hosting platform (Render, Railway, etc.).
set -e

echo "[start] Running Alembic migrations..."
alembic upgrade head
echo "[start] Migrations done."

echo "[start] Starting uvicorn on port ${PORT:-8000}..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers "${WEB_CONCURRENCY:-1}" \
    --loop uvloop \
    --http httptools
