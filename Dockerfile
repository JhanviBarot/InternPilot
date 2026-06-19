# ---- Build stage: install Python dependencies ----
FROM python:3.12-slim AS builder

WORKDIR /app
ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    PYTHONDONTWRITEBYTECODE=1

# Install uv
RUN pip install --no-cache-dir uv==0.5.26

# Install only production deps, frozen from uv.lock
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-cache

# ---- Runtime stage ----
FROM python:3.12-slim AS runtime

WORKDIR /app

# Copy the virtual env from builder (avoids re-installing in runtime)
COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Copy application code
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini ./
COPY scripts/start.sh ./scripts/start.sh
RUN chmod +x ./scripts/start.sh

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"

CMD ["./scripts/start.sh"]
