# InternPilot

Internship search and application intelligence platform. Ranks roles by expected value, flags ghost jobs, drafts grounded applications, and routes candidates to warm intros instead of cold applies.

## Running Locally

Both the backend and frontend must run simultaneously.

### Backend

```bash
# From repo root
cp .env.example .env   # fill in JWT_SECRET, DATABASE_URL, and at least one LLM API key

# Apply database migrations (requires PostgreSQL 14+ with pgvector)
uv run alembic upgrade head

# Start the dev server (runs on :8000)
uv run uvicorn app.main:app --reload
```

**Required environment variables** (set in `.env`):
- `DATABASE_URL` — PostgreSQL connection string, e.g. `postgresql+asyncpg://postgres:postgres@localhost:5432/internpilot`
- `JWT_SECRET` — long random string for signing JWTs
- `CORS_ORIGINS` — comma-separated allowed frontend origins, e.g. `http://localhost:5173,http://localhost:8080`
- At least one LLM key: `GROQ_API_KEY`, `GEMINI_API_KEY`, or `OPENROUTER_API_KEY`

API docs available at `http://localhost:8000/api/docs` once the server is running.

### Frontend

```bash
# From the frontend/ directory
cd frontend
npm install
npm run dev   # runs on :5173 (default Vite port; Lovable sandbox uses :8080)
```

**Required environment variables** (set in `frontend/.env`):
```
VITE_USE_MOCKS=false
VITE_API_BASE_URL=http://localhost:8000/api
```

Both must run simultaneously. The frontend calls `http://localhost:8000/api` directly — there is no proxy.

### PostgreSQL + pgvector

PostgreSQL 14+ with the `pgvector` extension is required. Quick start with Docker:

```bash
docker run -d \
  --name internpilot-db \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

Then set `DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/internpilot` in `.env`.

### Running Tests

```bash
# Requires a separate test database
TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/internpilot_test \
  uv run pytest --tb=short -q
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2 async, asyncpg |
| Database | PostgreSQL + pgvector |
| Auth | JWT (python-jose) + Argon2 passwords + Google OIDC |
| LLM | Gemini 2.5 Flash → Groq → OpenRouter (fallback chain) |
| Embeddings | sentence-transformers `all-MiniLM-L6-v2` (local, dim=384) |
| Frontend | React 19, TanStack Router + Start, Tailwind CSS v4 |
| Package mgr | uv (backend), npm (frontend) |

## Architecture Notes

- All frontend API calls go through `frontend/src/lib/api-client.ts` — single seam
- `VITE_USE_MOCKS=true` (default without `.env`) uses in-memory fixtures; `false` hits the real backend
- Backend errors always return `{ "error": { "code": string, "message": string } }`
- Data isolation: every DB query is scoped to the authenticated user's `user_id`
- See `API_CONTRACT.md` for the full endpoint spec
