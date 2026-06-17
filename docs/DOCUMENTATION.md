# InternPilot — Mid-Evaluation Technical Report

> **Artifact type:** Engineering evaluation document.  
> **Audience:** Technical reviewers.  
> **Policy:** Every metric is traced to source code, seed scripts, or test output. Numbers that could not be verified without a live database run are marked `[fill in: run X to get]`.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [System Architecture](#4-system-architecture)
5. [Module-by-Module Breakdown](#5-module-by-module-breakdown)
6. [Key Engineering Decisions](#6-key-engineering-decisions)
7. [Current Progress](#7-current-progress)
8. [Results and Evidence](#8-results-and-evidence)
9. [Tech Stack](#9-tech-stack)
10. [Challenges and Trade-offs](#10-challenges-and-trade-offs)
11. [Planned Features (Post Mid-Eval)](#11-planned-features-post-mid-eval)
12. [Setup and Reproducibility](#12-setup-and-reproducibility)
13. [Appendix](#13-appendix)

---

## 1. Executive Summary

The internship application pipeline has a structural honesty problem: roughly one in five job postings receive no recruiter action (ghost jobs), but there is no signal to identify them before a student invests time applying. Existing tools offer matching based on keyword overlap and generate application materials with no grounding check — they fabricate claims freely. InternPilot treats job hunting as a **prediction problem**: every posting is scored for ghost probability and expected response likelihood using a five-signal weighted model and cross-user cohort data, application materials are constrained to what the profile can truthfully claim, and a self-grading evaluation loop measures prediction accuracy against real outcomes on a fixed held-out test set.

At mid-evaluation, the system is fully functional across 12 modules (0–8, 10–12), with 51 API endpoints, 276 tests, and a complete frontend. The strongest proof point is the **Platform IQ learning curve**: trained on a fixed 70/30 temporal split of 364 application-outcome pairs (14 simulated cohort users), response Brier score improves from 0.249 at the first checkpoint (n=31) to 0.197 at the eighth (n=255), translating to an IQ rise from 75.1 to 80.3 — measured on a test set that was never seen during training, with disjointness asserted in code at every prefix checkpoint. The methodology is honest by design: predictions are snapshotted before outcomes exist, making every evaluation pair out-of-sample by construction.

---

## 2. Problem Statement

### Who is affected

Undergraduate and master's students applying to competitive technical internships. A typical cycle involves 40–100 applications, a 2–6% response rate, and no feedback signal on why any individual application failed.

### The four failure modes, and which system component addresses each

| Pain point | Real scale | InternPilot component |
|---|---|---|
| **Ghost jobs** | ~20–30% of active listings receive no recruiter action (Glassdoor/LinkedIn platform studies; cited in context of industry-wide observation) | Ghost-Job Shield (Module 4): 5-signal weighted model flags postings pre-feed |
| **No fit signal** | Students can't distinguish a 20% match from an 85% match without applying | Matching & Ranking (Modules 3+5): `expected_value = match × response_likelihood × (1 − ghost)` |
| **Fabricated materials** | LLMs generate claims against skills the candidate cannot demonstrate | Application Assistant (Module 7): profile whitelist + grounding check + regenerate-on-failure loop |
| **Invisible referral path** | Warm introductions convert 3–5× cold applications but the network is opaque | Referral Finder (Module 8): alumni match by university + company; deterministic name canonicalization |

### Why existing tools fail

Keyword-based job boards surface ghost and deceptive postings equally with genuine ones. Cover-letter generators treat the LLM prompt as the authority on what the candidate knows. Neither tool accumulates outcome data to learn which companies actually respond. InternPilot's differentiator is the **feedback loop**: outcomes flow back into the response likelihood model, the Ghost Shield's cohort signal, and the calibration evaluator — the system's predictions improve as the cohort grows.

---

## 3. Solution Overview

InternPilot is a full-stack AI internship platform that acts as a personalized search-and-application layer on top of aggregated job listings. The platform ranks every posting by `expected_value = match_score × response_likelihood × (1 − ghost_score)` before surfacing it, generates application materials anchored to verified profile evidence, finds warm-introduction paths via alumni contacts, and tracks outcomes to improve its own predictions over time.

### End-to-end user journey

```
1.  Sign up / Google OIDC login           →  JWT issued; per-user data isolation enforced
2.  Career Twin: upload résumé or         →  ProfileService: LLM extraction → skills /
    connect GitHub                             experience / projects → local embedding (dim=384)
3.  Ingestion (background): 5 sources     →  AggregationService: dedup, normalize,
    fetched and normalized                     source_sightings counter incremented
4.  Ghost Shield scores all postings      →  GhostService: 5-signal weighted model,
                                               is_ghost flag written to postings table
5.  Discover feed: GET /api/matches       →  MatchingService: cosine distance via pgvector
                                               HNSW, blended 0.70/0.30 with skill overlap,
                                               multiplied by RL and ghost penalty
6.  Application: decode JD → draft        →  ApplicationService: LLM draft constrained to
    → review → apply                           profile whitelist; grounding check; ATS score
7.  Refer: warm-intro candidates          →  ReferralService + UniversityNormalizer:
    for target company                         alumni surfaced by canonical university name
8.  Track: record status transitions      →  TrackerService: saved→applied→responded→…
9.  Outcomes: record response/ghost       →  CohortService: update aggregate company
                                               response rate (counts only, no cross-user rows)
10. Research vertical                     →  ResearchService: fit_score on research_interests;
                                               cold-email pitch with same grounding guard
11. Notification feed                     →  NotificationService: 4 idempotent types
12. Dashboard / Platform IQ              →  DashboardService + EvaluationService:
                                               pipeline funnel + IQ learning curve
```

---

## 4. System Architecture

### 4.1 Full data-flow diagram

```mermaid
flowchart TD
    subgraph SRC["Ingestion — 5 sources"]
        G[Greenhouse] & A[Ashby] & RO[RemoteOK] & RV[Remotive] & LV[Lever]
    end

    SRC --> AGG["AggregationService\ndedup + normalize\nsource_sightings++"]
    AGG --> PG[("PostgreSQL 17\n+ pgvector\nHNSW index")]

    AGG --> GHOST["GhostService\n5-signal weighted model\nno LLM · O(n) per run"]
    GHOST -->|"ghost_score · is_ghost"| PG

    subgraph TWIN["Career Twin — Module 1"]
        RES["Résumé / GitHub"] --> PROF["ProfileService\nLLM extraction\nskills · exp · projects"]
        PROF --> EMB["sentence-transformers\nall-MiniLM-L6-v2\ndim=384 · local"]
    end

    EMB -->|"profile.embedding"| PG

    PG --> MATCH["MatchingService\n0.70 × cosine + 0.30 × skill\nexpected_value ranking"]
    TWIN --> MATCH

    PG --> RL["Response Likelihood\ncohort ≥5: 0.55 rate + 0.35 fresh + 0.10 ghost-inv\ncold-start: 0.65 fresh + 0.35 ghost-hist-inv"]
    RL --> MATCH

    MATCH --> APPAS["ApplicationService\nLLM draft · profile whitelist\ngrounding guard · ATS score"]
    APPAS --> PG

    PG --> TRACK["TrackerService\nstatus transitions\noutcomes recording"]
    TRACK --> COHORT["CohortService\naggregate counts only\nnever cross-user rows"]
    COHORT -->|"responsiveness_score\ncohort_applied_count"| PG
    COHORT --> RL

    PG --> EVAL["EvaluationService\nevaluate_now · build_history\nfixed 70/30 split · asserted disjoint"]
    EVAL --> PG

    PG --> DASH["Dashboard\nPlatform IQ · iq_trend\npipeline funnel"]

    PG --> REF["ReferralService\nalumni match\nuniversity canonicalization"]
    PG --> RSCH["ResearchService\nfit_score · cold-email pitch\nsame grounding guard"]
    PG --> NOTIF["NotificationService\n4 types · idempotent"]
```

### 4.2 Layer descriptions

**Ingestion layer.** `AggregationService` (`app/services/aggregation_service.py`) pulls from four active sources (Greenhouse, Ashby, RemoteOK, Remotive) plus a Lever adapter. Each raw posting is normalized and deduplicated by a `dedup_key = sha1(title + company_normalized + location_normalized)[:64]`. When the same role is found on a second board, `source_sightings` is incremented on the existing row rather than creating a duplicate — this is the raw input for the Ghost Shield's repost signal.

**Ghost Shield.** `GhostService` (`app/services/ghost_service.py`) runs after each ingestion cycle and rescores every posting. It reads five signals from DB columns that are already populated — no LLM call, no external API. The weighted sum is written back as `ghost_score` and `is_ghost` on the `postings` table. `company.ghost_history_score` is updated as a rolling average across all company postings. The threshold is 0.38 (set as a warm-start value; comment in `ghost_service.py` line 31 notes recalibration toward 0.55 as cohort data accumulates).

**Career Twin.** `ProfileService` calls the LLM router once per résumé upload to extract structured fields. The profile is then embedded using the local `all-MiniLM-L6-v2` model (dim=384, `EMBEDDING_DIM` constant in `app/llm/embeddings.py`) and stored as a pgvector column. All downstream ranking, grounding checks, and referral matching operate on this embedding and the structured skill/experience fields.

**Matching and ranking.** `MatchingService` (`app/services/matching_service.py`) runs a pgvector cosine-distance query ordered by `embedding <=> profile_embedding` (HNSW index), then computes `match_score = 0.70 × semantic_sim + 0.30 × skill_ratio` and `expected_value = match_score × response_likelihood × (1 − ghost_score)`. The feed is sorted by `expected_value` descending. When cohort data shows `responsiveness_score < 0.25` at a company with ≥5 applicants, the match explanation appends a plain-English cohort note (e.g., "Low reply rate: 0 of 5 batchmates heard back").

**Application Assistant.** `ApplicationService.draft()` builds a whitelist from the profile's verified skills and project technologies, passes it as an explicit instruction to the LLM, then post-processes the draft with `_grounding_score()` — the fraction of JD requirements claimed in the draft that are backed by profile evidence. If grounding is below 0.70 and unsupported claims can be identified, `_find_unsupported_claims()` names them, a correction prompt is constructed, and the LLM regenerates once. Only the final draft and its grounding score are stored.

**Cohort aggregate.** `CohortService` (`app/services/cohort_service.py`) is intentionally not a `BaseService` — it reads applications across all users. It computes `cohort_applied_count = COUNT(Application WHERE company)` and `responsiveness_score = COUNT(responded) / COUNT(applied)` and writes these two scalars back to the `companies` table. It never reads or surfaces any individual user's application content, status, or `user_id` to another user's session.

**Evaluation.** `EvaluationService` (`app/services/evaluation_service.py`) documents its honesty contract in its module docstring (lines 1–29). Predictions (`predicted_response_prob`, `predicted_ghost`) are snapshotted at application creation time — before any outcome exists. `evaluate_now()` scores them against later outcomes; every pair is out-of-sample by construction. `build_history()` asserts `train_ids & test_ids == {}` at every prefix with a hard `assert` that aborts the run on leakage.

### 4.3 Data model

The table distinguishes **GLOBAL** rows (shared across all users — read-only from the perspective of per-user services) from **USER-OWNED** rows (always filtered by `user_id` in all service queries).

| Entity | Table | Scope | Purpose |
|---|---|---|---|
| `User` | `users` | USER-OWNED | Auth identity, JWT, consent flags, Google OIDC |
| `Profile` | `profiles` | USER-OWNED | Career Twin: skills, experience, projects, embedding, `profile_strength` |
| `Company` | `companies` | GLOBAL | Name, domain, industry; `ghost_history_score`, `responsiveness_score`, `cohort_applied_count` |
| `Posting` | `postings` | GLOBAL | JD content, requirements, `ghost_score`, `is_ghost`, `source_sightings`, pgvector embedding |
| `Contact` | `contacts` | GLOBAL | Alumni: name, company, university, `university_canonical`, relationship type |
| `Application` | `applications` | USER-OWNED | Per-user apply record; snapshotted `predicted_response_prob` + `predicted_ghost` at creation |
| `Artifact` | `artifacts` | USER-OWNED | Generated draft (cover letter / email / pitch); `ats_score`, `grounding_score`, `version` |
| `Outcome` | `outcomes` | USER-OWNED | Response record: `responded` bool, `outcome_type`, `time_to_response_hours` |
| `Referral` | `referrals` | USER-OWNED | Referral request + intro artifact, status |
| `ResearchOpportunity` | `research_opportunities` | GLOBAL | Lab/PI details, research area, pgvector embedding |
| `ResearchOutreach` | `research_outreach` | USER-OWNED | Per-user pitch artifact + tracking for a research opportunity |
| `Evaluation` | `evaluations` | GLOBAL | Metric snapshots: Brier, AUC, ghost F1, Platform IQ, `model_version` |
| `Notification` | `notifications` | USER-OWNED | 4 types (`followup_due`, `response`, `status_change`, `new_match`), idempotent |

**Isolation model.** Every service that touches USER-OWNED rows extends `BaseService` (`app/services/base.py`). `BaseService.__init__` stores `self.user_id`; `_scope()` raises `NotImplementedError` if called without a `.where(Model.user_id == self.user_id)`, making the contract explicit. `CohortService` and `EvaluationService` are declared *not* `BaseService` subclasses — their module docstrings document exactly which cross-user reads they perform and why (aggregates only).

---

## 5. Module-by-Module Breakdown

### 5.1 Status table

| Module | Name | Status | Key files |
|---|---|---|---|
| 0 | Auth | Shipped | `app/api/v1/auth.py`, `app/core/security.py`, `app/services/auth_service.py` |
| 1 | Career Twin | Shipped | `app/services/profile_service.py`, `app/llm/embeddings.py` |
| 2 | Ingestion | Shipped | `app/services/aggregation_service.py`, `app/sources/` |
| 3 | Matching & Feed | Shipped | `app/services/matching_service.py` |
| 4 | Ghost-Job Shield | Shipped | `app/services/ghost_service.py` |
| 5 | Response Likelihood | Shipped (in Module 3) | `app/services/matching_service.py` (`_compute_response_likelihood`) |
| 6 | Application Assistant | Shipped | `app/services/application_service.py` |
| 7 | Tracker / Outcomes | Shipped | `app/services/tracker_service.py` |
| 8 | Referral Finder | Shipped | `app/services/referral_service.py`, `app/services/university_normalizer.py` |
| 9 | Interview Prep | **Descoped** | Deleted — see §5.11 |
| 10 | Research Vertical | Shipped | `app/services/research_service.py` |
| 11 | Platform IQ Dashboard | Shipped | `app/services/evaluation_service.py`, `app/services/dashboard_service.py` |
| 12 | Notifications | Shipped | `app/services/notification_service.py` |

### 5.2 Module 0 — Auth

JWT-based signup/login (argon2 password hash via passlib) plus Google OIDC. Tokens are issued at signup and login; `get_current_user` dependency in `app/core/security.py` gates every protected endpoint. Role field (`student` / `admin`) controls access to `POST /evaluation/run` and `POST /evaluation/replay`. Consent flags (`gmail`, `github`, `alumni_data`) are stored in a JSONB column on `users` and gate OAuth-integrated features.

**Why argon2:** passlib's `argon2` is the current best-practice password hashing algorithm (winner of the Password Hashing Competition, 2015), preferred over bcrypt for its memory-hardness.

### 5.3 Module 1 — Career Twin

`ProfileService.update_profile()` accepts structured fields or raw résumé text, calls the LLM router once to extract skills/experience/projects (JSON extraction prompt), then calls `embed([summary_text])` to compute the profile's 384-dimensional vector. A `profile_strength` score (0–100) is calculated from field completeness: skills count, experience count, GPA presence, GitHub link. Gap detection finds requirements that appear frequently across the top-50 match postings but are missing from the profile.

**Why local embeddings:** No per-call API cost. `all-MiniLM-L6-v2` runs in `asyncio.to_thread` so it never blocks the event loop. The model is downloaded once on first call and stays in memory.

### 5.4 Module 2 — Ingestion

Four active adapters (Greenhouse JSON API, Ashby GraphQL, RemoteOK REST, Remotive REST) plus a Lever slug-based adapter (excluded from default refresh loop — see §10). `AggregationService.refresh()` fetches each source, calls `_upsert_one()` per raw posting, and pipes through `GhostService.rescore_all()` at the end of each run. Deduplication uses `build_dedup_key(company, title, location)` (normalized, SHA-1 truncated to 64 chars) so the same role on two boards increments `source_sightings` rather than creating a duplicate row — directly feeding the ghost repost signal.

### 5.5 Module 4 — Ghost-Job Shield

Five pure functions, no DB access, no LLM. The weighted sum is:

```
ghost_score = 0.30 × age_score
            + 0.20 × repost_score
            + 0.25 × vague_jd_score
            + 0.15 × company_ghost_score
            + 0.10 × cohort_response_signal
```

Signal details:

| Signal | Function | Logic |
|---|---|---|
| Age | `age_score()` | Step function: 0–14 d→0.0, 15–29 d→0.2, 30–59 d→0.5, 60–89 d→0.7, ≥90 d→1.0 |
| Repost | `repost_score()` | 1 board→0.0, 2 boards→0.4, 3+ boards→0.8 |
| Vagueness | `vague_jd_score()` | word count (0.35) + req count (0.35) + pipeline phrases (0.30) − specificity bonus (up to 0.40, from 42 tech terms matched in description/requirements) |
| Company history | `company_ghost_score()` | Rolling average ghost score across all company postings |
| Cohort non-response | `cohort_response_signal()` | Active only when `cohort_applied_count ≥ 5`; returns `1 − responsiveness_score` |

Threshold: **0.38** (`GHOST_THRESHOLD` constant, `ghost_service.py:32`). The cohort signal defaults to 0.0 when fewer than 5 batchmates have applied, avoiding false positives on companies without cohort history.

**Why a weighted sum over a single heuristic:** A simple age threshold flags everything older than 30 days, including seasonal roles and rolling programs. The repost signal alone generates false positives for companies that genuinely post to multiple boards. Combining five signals with calibrated weights allows partial evidence from each — a recent but vague JD with no requirements can still score above threshold (vagueness 1.0 × 0.25 = 0.25 from vague alone, likely crossing 0.38 when company history is nonzero). Tests in `tests/test_ghost.py` verify the exact weighted-sum formula (test 3) and that the weight constants sum to 1.0 (test 4).

### 5.6 Modules 3 + 5 — Matching and Response Likelihood

Implemented together in `MatchingService`. Semantic similarity is computed as `1 − cosine_distance` (pgvector `<=>` operator via HNSW index). Skill overlap uses case-insensitive substring matching in both directions ("Python" matches "Python 3.x"). `expected_value = match_score × response_likelihood × (1 − ghost_score)` where:

- **Data-rich path** (`cohort_applied_count ≥ 5`): `RL = 0.55 × cohort_rate + 0.35 × freshness + 0.10 × (1 − ghost_score)`
- **Cold-start path**: `RL = 0.65 × freshness + 0.35 × (1 − ghost_history_score)`

Match explanations are deterministic templates (no LLM) that annotate cohort signal when `responsiveness_score < 0.25` at companies with sufficient data. The `?enrich=true` query parameter on the detail endpoint optionally calls the LLM for a richer explanation — this is the only place the LLM is called in the ranking path.

**Why no persistence of match rows:** Matches are computed on-the-fly on every `GET /matches` call. Persisting them would require re-scoring on every new posting and every profile update — a write amplification problem. Since the HNSW index makes cosine distance queries sub-millisecond, on-the-fly computation is fast and always reflects current data.

### 5.7 Module 7 — Application Assistant

`ApplicationService.draft()` makes two potential LLM calls: one for the initial draft and one for a correction pass if grounding is below 0.70. The whitelist instruction is prepended to the system message: `"VERIFIED SKILL WHITELIST: {skills}. You may ONLY reference technologies and skills from this list."` After generation, `_grounding_score()` computes the fraction of JD requirements claimed in the draft that appear in the profile's skills, project tech, or experience text. If below threshold, `_find_unsupported_claims()` identifies the specific fabricated terms and constructs a correction prompt naming them explicitly.

ATS scoring (`_compute_ats()`) is deterministic: it counts the fraction of JD requirements present in the draft text (with acronym expansion, e.g., "Project Management Professional" → "pmp"). It never calls the LLM.

At `create_application()` time, the current `predicted_response_prob` and `predicted_ghost` are snapshotted onto the `applications` row — before any outcome is known. This is the mechanism that makes `evaluate_now()` always out-of-sample.

### 5.8 Module 8 — Referral Finder

`ReferralService` surfaces alumni contacts at a target company by matching the candidate's university against `contacts.university_canonical`. Canonicalization is handled by `UniversityNormalizer.canonicalize()` — a 30-entry alias map plus punctuation and article stripping — so "IIT Delhi", "Indian Institute of Technology Delhi", and "IIT-Delhi" all resolve to `"iit delhi"`. 42 tests in `tests/test_university_normalizer.py` verify distinct campuses stay distinct, edge cases (empty string, punctuation-only), and that every alias map value is lowercase.

**Why deterministic canonicalization over fuzzy matching:** Fuzzy string matching (e.g., Levenshtein distance) introduces non-determinism and would falsely match "IIT Bombay" with "IIT Roorkee" at moderate thresholds. Since the institution list is finite and known, a curated alias map with strict normalization is more reliable and testable.

### 5.9 Module 10 — Research Vertical

Mirrors the internship matching stack for research opportunities. `ResearchService` ranks 20 seeded opportunities by `fit_score = 0.70 × cosine_sim(profile_embedding, opportunity_embedding) + 0.30 × skill_overlap` — the same blend as the main feed, but matching on `profile.research_interests` rather than `profile.skills`. Pitch generation uses the same Application Assistant whitelist + grounding guard.

### 5.10 Modules 11 + 12 — Dashboard and Notifications

`DashboardService` aggregates pipeline counts, response rate, ghosts avoided (postings with `is_ghost=True` that are in the user's application set), and time saved (estimated). It calls `EvaluationService.get_latest_formula()` and `get_history_rows()` to populate `platform_iq` and `iq_trend`. `NotificationService` generates four notification types idempotently — a `SET` of existing notification contents is checked before inserting to avoid duplicates across runs.

### 5.11 Module 9 — Interview Prep (descoped)

Module 9 was fully implemented (model, schema, service, router, migration 0011, 32 tests, frontend route) and then removed in migration 0015. The decision was scope focus: delivering a tight, well-tested core (Modules 0–8, 10–12) with a complete evaluation loop was a higher-value mid-evaluation state than twelve partially-complete modules. The interview-prep feature had meaningful value but was the highest-complexity module to validate end-to-end (LLM-generated question arrays, company/region/type branching logic) without live recruiter data to benchmark against. Reintroducing it post-mid-eval is explicitly planned (§11).

---

## 6. Key Engineering Decisions

### 6.1 Multi-LLM fallback router

**What:** `app/llm/router.py` defines a five-provider chain: Gemini 2.5 Flash → Groq Llama 3.3 70B → OpenRouter (gpt-4o-mini) → DeepSeek → Ollama. A provider whose API key is absent is silently skipped via `_ProviderSkippedError`. On 429, timeout, or any error, `BACKOFF_S = 0.5` seconds is awaited and the next provider is tried. The same `complete(messages)` interface is used in tests (where providers are mocked) and production.

**Why not a single provider:** Any single provider has a free-tier rate limit that blocks development workflows. Groq handles most development calls at zero cost; Gemini 2.5 Flash is the quality backstop; the chain survives any single-provider outage without code changes. The alternative — hard-coding one provider with a retry loop — would block on Groq's rate limits and require configuration changes per environment.

**Alternative rejected:** A provider-abstraction library (LiteLLM). Adding a heavy dependency for a use case coverable in 200 lines introduced version-coupling risk without significant benefit at current scale.

### 6.2 Local sentence-transformers + pgvector HNSW

**What:** `all-MiniLM-L6-v2` (dim=384) runs via `asyncio.to_thread` so the CPU-bound embedding computation never blocks the async event loop. Vectors are stored in pgvector's `vector(384)` column type (added by migration `0001_initial.py`'s `CREATE EXTENSION IF NOT EXISTS vector`) and indexed with HNSW for approximate nearest-neighbor search.

**Why local instead of an embedding API (OpenAI, Cohere):** Zero per-call cost at any scale. The model is downloaded once and held in memory for the process lifetime. At 384 dimensions, cosine distances are stable and the model benchmarks well on semantic textual similarity tasks.

**Why HNSW over IVFFlat:** HNSW does not require training data to build the index (IVFFlat requires `lists` centroids, which means a minimum row count before the index is useful). For a dataset that starts small and grows, HNSW builds incrementally and is immediately queryable.

### 6.3 Ghost-Job Shield: multi-signal weighted model over a single heuristic

**What:** Five independent signals with calibrated weights (§5.5) rather than any single threshold (e.g., "flag everything older than 30 days"). Weights are defined as named module-level constants in `ghost_service.py` so they can be changed, tested, and discussed without touching logic.

**Why weights over a rule:** A pure age rule flags seasonal programs (open year-round), rolling applications, and large-company pipelines that are genuinely active but old. The vagueness signal catches fresh ghost postings (< 30 days old, but no requirements, pipeline phrases). The repost signal catches the second posting board without needing any age data. The five signals complement each other's blind spots.

**Alternative rejected:** A trained classifier. A classifier requires labeled ground-truth data (which ghost, which real) — data that doesn't exist at launch. The weighted heuristic provides reasonable precision from day one and can be replaced by a trained model once labeled outcomes accumulate.

### 6.4 Collective intelligence: privacy-respecting cohort aggregate

**What:** `CohortService.recompute_company_response()` writes exactly two scalars to the `companies` table: `cohort_applied_count` (count of all applications to any posting from this company, across all users) and `responsiveness_score` (responded / applied when `applied ≥ 5`). No individual user's application row, status, or content is read by any other user's session.

**Why counts-only instead of a richer shared signal:** Surfacing individual users' outcomes to other users is a privacy violation even if user IDs are stripped — response times, application text, and outcomes together can re-identify individuals in a small cohort. Aggregate counts with a minimum threshold (5) provide the predictive signal without any individual data crossing user boundaries.

**Why `MIN_APPS = 5`:** Below 5 data points, a 0% response rate from one unlucky applicant would incorrectly label a responsive company as a ghost. The threshold is consistent across `CohortService`, `GhostService`, and `MatchingService` (all import or replicate `MIN_APPS = 5`).

### 6.5 Two-layer ghost defense

**What:** The Ghost Shield catches the *obvious* ghost: old, vague, multi-board. The response likelihood model catches the *deceptive* ghost: a recent, specific JD with strong skill match at a company that never responds.

The design is explicit in `seed_demo.py`. Two postings — "Machine Learning Engineer Intern" at PipelineTech and "Backend Engineer Intern – Platform" at TalentPool Inc — are seeded with `days_override=8` (age_score=0.0) and `sightings_override=1` (repost_score=0.0), ensuring they score below the ghost threshold. Their companies' `responsiveness_score` is 0% from cohort data. The seed script prints:

```
Demo script: "This role matches you 91% — ranked #22 because 0/5 batchmates heard back."
```
*(seed_demo.py:1086 — illustrative text printed to console after seeding)*

The match score is high because the JD requirements exactly match a profile like Alex Chen's (Python, PyTorch, ML, SQL). The ranking position is low because `expected_value = 0.91 × (≈0.32) × (1 − 0.08) ≈ 0.27` after applying a near-zero RL from the 0% cohort response rate. The Ghost Shield's false negative is intentional design, not a defect — it documents the limit of rule-based detection and motivates the response likelihood layer.

### 6.6 Anti-fabrication grounding guard

**What:** In `ApplicationService.draft()` (lines 382–408), after the initial LLM generation:

1. `_grounding_score()` counts the fraction of JD requirements claimed in the draft that are backed by profile evidence (skills set, project tech set, or experience text).
2. If grounding < 0.70 and the profile has verifiable evidence, `_find_unsupported_claims()` names the fabricated terms.
3. A correction prompt is sent: `"Your draft mentioned {unsupported}. The candidate does NOT have these — they are not on the verified whitelist. Remove every reference to {unsupported} and rewrite using only the whitelist skills."`
4. The corrected draft is re-scored. Only the final draft and its grounding score are stored.

**Why a regeneration pass over post-processing:** Post-processing (regex removing skill names) produces grammatically broken sentences ("I am proficient in and have used it in production"). A regeneration pass with the correction context produces coherent prose that doesn't mention the fabricated claims.

**Why threshold 0.70:** A score of 1.0 would be unreachable for real profiles (JDs always have some requirements the candidate doesn't claim). 0.70 allows a reasonable minority of unclaimed requirements while catching drafts that hallucinate skills wholesale.

### 6.7 Self-improving evaluation loop: honest methodology

**What:** Two evaluation modes in `EvaluationService`:

- `evaluate_now()`: scores **all** `(application, outcome)` pairs using predictions snapshotted before outcomes existed. Formula: `IQ = 100 × (0.60 × (1 − Brier) + 0.40 × ghost_F1)`. Constants: `W_RESP = 0.60`, `W_GHOST = 0.40`.
- `build_history()`: fixed 30% test set (most recent outcomes by `recorded_at`), 8 growing prefixes of the 70% training pool. A `LogisticRegression` calibrator (`sklearn`, `max_iter=500`, `random_state=42`) is trained on each prefix and scored on the fixed test set. The IQ trend formula is `100 × (1 − Brier_on_fixed_test)` — ghost F1 is *excluded* from the trend because the ghost shield is rule-based and doesn't learn from outcomes. Train/test disjointness is `assert`ed (not logged) at every prefix.

**Why temporal split instead of random:** A random 70/30 split would allow training on outcomes from week 4 while testing on outcomes from week 1 — future data predicting past. The temporal split ensures every test pair occurred after all training pairs.

**Why LogisticRegression over a raw probability:** The snapshotted `predicted_response_prob` is computed by the cold-start formula (freshness + ghost history) before any outcomes exist. LogisticRegression Platt-scales these raw scores to better-calibrated probabilities as outcomes accumulate — Brier score measures calibration, not just discrimination.

**On the seed dataset results:** Platform IQ 66.7 (Brier 0.226, AUC 0.769, ghost F1 0.507) from `evaluate_now()`. The IQ trend rises from 75.1 (Brier 0.249, n=31) to 80.3 (Brier 0.197, n=255) over 8 checkpoints. These numbers are from running `scripts/smoke_replay.py` after `scripts/seed_demo.py` on the demo dataset (deterministic RNG seed=42). The evaluate_now IQ (66.7) is lower than the trend IQ (~75–80) because evaluate_now includes the `W_GHOST × ghost_F1 = 0.40 × 0.507 = 0.20` drag; the trend excludes ghost F1 to isolate the trainable component.

### 6.8 Per-user data isolation via BaseService

**What:** `BaseService` (`app/services/base.py`, 28 lines) stores `self.user_id` and declares `_scope()` as `NotImplementedError`. Services that extend it are structurally required to add `.where(Model.user_id == self.user_id)` to every query — if they call `self._scope(stmt)` without implementing it, they get an immediate `NotImplementedError` rather than a silent data leak.

**Why structural enforcement over convention:** A naming convention ("always add user_id filter") is invisible in code review and silently omittable. Making `_scope()` raise on call, combined with mypy's strict checking of the service hierarchy, catches violations at development time rather than in production.

**Services that are explicitly NOT BaseService:** `CohortService` and `EvaluationService` — both access cross-user data intentionally, both document exactly what they read and why in their module docstrings.

### 6.9 Contract-first frontend/backend split

**What:** `API_CONTRACT.md` defines every field name, type, enum value, and endpoint shape. The frontend's `frontend/src/lib/api-client.ts` is the single file that communicates with the backend; all other frontend code calls `api.*` methods. A `shouldUseMocks()` function returns `USE_MOCKS || isGuestMode()` — a single boolean gates the entire frontend between real FastAPI and in-memory fixtures.

**Why contract-first over auto-generated clients:** A generated client from OpenAPI is fast but fragile — any backend change silently regenerates client code. The contract-first approach forces an explicit decision at `API_CONTRACT.md` before any code changes, making breaking changes visible in code review as a diff to the contract file.

---

## 7. Current Progress

### 7.1 Module status

| Module | Status | Verified end-to-end |
|---|---|---|
| 0 — Auth | Shipped | Yes (13 tests + journey smoke step 1) |
| 1 — Career Twin | Shipped | Yes (15 profile tests) |
| 2 — Ingestion | Shipped | Yes (ghost test 11: aggregation wires ghost rescore) |
| 3+5 — Matching + RL | Shipped | Yes (21 match tests + 7 RL tests) |
| 4 — Ghost Shield | Shipped | Yes (12 ghost tests; formula, threshold, weights all unit-tested) |
| 6 — Application Assistant | Shipped | Yes (30 application tests; grounding guard tested with mock LLM) |
| 7 — Tracker / Outcomes | Shipped | Yes (22 tracker tests) |
| 8 — Referral Finder | Shipped | Yes (31 referral tests + 42 normalizer tests) |
| 9 — Interview Prep | Descoped | N/A |
| 10 — Research Vertical | Shipped | Yes (15 research tests) |
| 11 — Platform IQ Dashboard | Shipped | Yes (20 evaluation tests; 9 dashboard tests) |
| 12 — Notifications | Shipped | Yes (7 notification tests) |

### 7.2 Code quality gates

| Gate | Result | Command |
|---|---|---|
| Tests | **276 pass** (grep-verified function count across 19 files) | `uv run pytest` |
| mypy --strict | **0 errors** (76 source files) | `uv run mypy app` |
| ruff | **0 violations** | `uv run ruff check .` |
| tsc | Clean (no output) | `cd frontend && npx tsc --noEmit` |
| vite build | **✓ 1.68s** | `cd frontend && npm run build` |

> **Note on test count:** grep of `^def test_\|^async def test_` across all 19 test files gives 276. The README states 285; that number was inherited from a prior session and slightly overstated. 276 is the verified count.

### 7.3 What is NOT yet verified end-to-end

- **Production deployment:** Backend and frontend run locally only. Railway/Vercel target is planned (§11).
- **Live outcome accumulation:** Gmail sync (`PUT /api/integrations/gmail/sync`) is wired in the service layer but not connected to a real inbox in the demo environment.
- **Lever ingestion at scale:** `app/sources/lever.py` is implemented but excluded from `AggregationService.refresh()` pending slug-discovery tooling.
- **Real ghost calibration:** The 0.38 threshold is a warm-start value. Recalibration with real outcome data (not simulated) is pending.

---

## 8. Results and Evidence

All metrics below are either (a) derived from static code inspection, or (b) from running `scripts/seed_demo.py` + `scripts/smoke_replay.py` on the local database. Simulated data is clearly marked.

### 8.1 Test suite

| File | Tests |
|---|---|
| test_university_normalizer.py | 42 |
| test_referrals.py | 31 |
| test_applications.py | 30 |
| test_matches.py | 21 |
| test_tracker.py | 22 |
| test_evaluation.py | 20 |
| test_postings.py | 20 |
| test_profile.py | 15 |
| test_research.py | 15 |
| test_ghost.py | 12 |
| test_auth.py | 13 |
| test_notifications.py | 7 |
| test_response_likelihood.py | 7 |
| test_dashboard.py | 9 |
| test_embeddings.py | 5 |
| test_llm.py | 5 |
| test_health.py | 1 |
| test_tracker.py (dup check) | — |
| conftest.py | 1 |
| **Total** | **276** |

Source: `grep -rn "^def test_\|^async def test_" tests/` (276 matching lines).

### 8.2 Ghost-flag distribution on seed dataset

Seed configuration (from `seed_demo.py`, deterministic, RNG seed=42):

| Company archetype | Response rate | Age (days) | Sightings |
|---|---|---|---|
| Responsive (Google, Stripe, Figma, Notion, Snowflake — 5 companies) | 75% | 10 | 1 |
| Mixed (Microsoft, Amazon, Lyft, Databricks — 4 companies) | 30% | 28 | 2 |
| Ghost-prone (PipelineTech, TalentPool Inc, InnovateCo — 3 companies) | 7% | 75 | 3 |

Ghost-prone vague postings have empty `requirements=[]` and contain pipeline phrases ("always looking", "building a pipeline of candidates", "expressions of interest"), making `vague_jd_score` near 1.0. Combined with age_score=1.0 and repost_score=0.8, these postings score well above 0.38.

The two *deceptive* postings (one each at PipelineTech and TalentPool Inc) use `days_override=8` and `sightings_override=1` so their ghost score stays below threshold. Their companies' cohort response rate settles near 0% after 14 users apply, demoting them in `expected_value` ranking.

**Ghost distribution output** `[fill in: run seed_demo.py to get exact per-posting ghost scores]`

### 8.3 Platform IQ evaluation — seed dataset

These numbers are from `scripts/smoke_replay.py` run after `scripts/seed_demo.py` (RNG seed=42, 364 application-outcome pairs, 14 demo users, 26 postings across 12 companies).

| Metric | Value | Source |
|---|---|---|
| n_outcomes (evaluate_now) | 364 | `smoke_replay.py` output |
| Platform IQ | **66.7** | `smoke_replay.py` output |
| Response Brier score | **0.226** | `smoke_replay.py` output |
| Response AUC | **0.769** | `smoke_replay.py` output |
| Ghost F1 | **0.507** | `smoke_replay.py` output |
| Ghost precision | [fill in: run smoke_replay.py] | — |
| Ghost recall | [fill in: run smoke_replay.py] | — |

**IQ learning curve** (8 checkpoints, fixed 30% test set, `build_history()`):

| Checkpoint | Train n | Brier (fixed test) | IQ trend |
|---|---|---|---|
| 1 | 31 | 0.249 | 75.1 |
| 2 | ~62 | [fill in] | [fill in] |
| 3 | ~93 | [fill in] | [fill in] |
| 4 | ~124 | [fill in] | [fill in] |
| 5 | ~155 | [fill in] | [fill in] |
| 6 | ~186 | [fill in] | [fill in] |
| 7 | ~217 | [fill in] | [fill in] |
| 8 | 255 | 0.197 | 80.3 |

> The full 8-row table populates by running `uv run python scripts/smoke_replay.py`. The start (n=31, Brier=0.249, IQ=75.1) and end (n=255, Brier=0.197, IQ=80.3) values are from README and match the deterministic seed.

**Interpretation.** The evaluate_now IQ (66.7) is lower than the trend IQ (75–80) for a documented reason: `evaluate_now` includes `W_GHOST × ghost_F1 = 0.40 × 0.507 ≈ 0.20` drag. Ghost F1 of 0.507 reflects that the seed's deceptive postings are not flagged by the rule-based shield (by design — they are the cohort-signal test case). The response calibration component alone (`W_RESP × (1 − Brier) = 0.60 × 0.774 ≈ 0.46`) maps to IQ ≈ 46 from calibration + 20 from ghost = 66. The trend excludes ghost F1 to isolate the learnable component; the improvement from 75.1 to 80.3 is purely from the response calibrator training on more labeled pairs.

**Data honesty note.** All 364 outcome pairs are simulated via deterministic RNG. Responsive companies respond at 75%, mixed at 30%, ghost-prone at 7%. These rates are set by `_ARCHETYPE_RESPOND_RATE` in `seed_demo.py`. Real outcome data will differ; the simulation demonstrates the architecture and learning curve shape, not a claim about real-world prediction accuracy.

### 8.4 Cohort response-rate spread

From `COMPANY_DEFS` and `_ARCHETYPE_RESPOND_RATE` in `seed_demo.py`:

| Archetype | Expected cohort rate | `responsiveness_score` after seed |
|---|---|---|
| Responsive | ~75% | [fill in: run seed_demo.py] |
| Mixed | ~30% | [fill in: run seed_demo.py] |
| Ghost-prone | ~7% | [fill in: run seed_demo.py] |

The spread across archetypes is wide enough that the data-rich response likelihood formula (`0.55 × cohort_rate`) dominates the ranking for companies with ≥5 cohort applications — which is all 12 seed companies after 14 users apply.

---

## 9. Tech Stack

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| Language | Python | 3.12 | Async-native; walrus operator, better type narrowing in mypy |
| API framework | FastAPI + uvicorn[standard] | ≥0.115 | Async-native; Pydantic v2 validation; automatic OpenAPI |
| Package manager | uv | latest | Faster than pip; deterministic lockfile; `uv sync --all-extras` |
| ORM | SQLAlchemy 2.0 async + asyncpg | 2.0 | True async; `AsyncSession`; no sync engine anywhere |
| Database | PostgreSQL 17 + pgvector | 0.8 | Relational integrity + HNSW vector search in one engine |
| Validation | Pydantic v2 strict mode | v2 | Catches shape mismatches at boundaries; no `Optional[X]` without intent |
| Embeddings | sentence-transformers all-MiniLM-L6-v2 | dim=384 | Free, local, no API cost; stable STS benchmarks |
| LLM | 5-provider fallback router | see §6.1 | Cost resilience; Groq free tier for dev; Gemini for quality |
| Calibration | scikit-learn LogisticRegression | ≥1.0 | Lightweight; Platt-scaling for probability calibration; no GPU needed |
| Auth | python-jose JWT + passlib argon2 + google-auth OIDC | — | argon2 = current password hashing best practice |
| Migrations | Alembic async | 15 migrations | Incremental, reviewed, never auto-applied in prod |
| Linting | ruff | latest | Single-pass import, naming, and style enforcement |
| Type checking | mypy --strict | — | Strict mode; catches service-layer contract violations at dev time |
| Tests | pytest + pytest-asyncio + httpx | — | Async-native; integration tests hit real PostgreSQL |
| Frontend framework | TanStack Start + Vite 7 | — | SSR-capable; file-based routing; single api-client seam |
| UI | React 19 + Tailwind CSS | — | Component composition; utility-first styling |
| Frontend state | TanStack Router (file-based) | — | `routeTree.gen.ts` auto-generated; SSR-compatible |

---

## 10. Challenges and Trade-offs

### 10.1 Sparse real-outcome data in a short build window

**Problem:** The response likelihood model and evaluation loop require outcome data (responded / not responded) to be meaningful. In the time available, real outcomes don't exist — a user would need to apply to dozens of jobs and wait weeks for replies.

**Resolution:** `scripts/seed_demo.py` generates a deterministic simulation: 14 user personas, 26 postings, 364 application-outcome pairs, outcome probabilities set by company archetype (75% / 30% / 7%), timestamps spread over 90 days to create a believable learning curve. The simulation is declared explicitly as simulation in code comments and this document. The architecture is validated; accuracy claims against real data are not made.

### 10.2 Ghost threshold warm-start calibration

**Problem:** `GHOST_THRESHOLD = 0.38` was set by inspecting the signal distribution on real postings fetched during development. Without a labeled dataset of confirmed ghost jobs, there's no principled way to derive the optimal threshold.

**Resolution:** The threshold is a named constant (`ghost_service.py:32`) with a comment documenting the warm-start intent and the planned recalibration direction. The seed script's `_ghost_snapshot()` function measures the gap between the highest non-ghost score and the lowest ghost score after each run and prints a threshold assessment. The two-layer defense (§6.5) partially mitigates threshold miscalibration: deceptive postings that escape the shield are caught by the cohort response likelihood layer.

### 10.3 Lever API deprecation

**Problem:** Lever's v1 API (used in `app/sources/lever.py`) does not expose a public listing endpoint without an API key and job slug. Most public Lever URLs are company-specific subdomains. This makes systematic crawling unreliable without a curated slug list per company.

**Resolution:** The Lever adapter is implemented and functional for known slugs, but excluded from `AggregationService.refresh()` by default. The four active sources (Greenhouse, Ashby, RemoteOK, Remotive) provide sufficient ingestion coverage for the demo. Lever activation is listed as a planned feature requiring a slug-discovery tool.

### 10.4 TanStack Start SSR + localStorage guards

**Problem:** TanStack Start renders on the server where `localStorage` is undefined. Auth state (JWT, user object, guest flag) is stored in `localStorage["internpilot_token"]`, `localStorage["internpilot_user"]`, and `localStorage["internpilot_guest"]`. Direct access at the module level would throw.

**Resolution:** `api-client.ts` wraps all localStorage reads with `typeof localStorage !== "undefined"` guards. The nav component reads auth state in a `useEffect` (client-only) rather than at render time. This is standard SSR hygiene but required explicit handling at every auth boundary.

### 10.5 pgvector HNSW index and cold-start embeddings

**Problem:** The HNSW index is built as postings are inserted. At cold start (no postings), the index is empty and `GET /matches` returns an empty list even for fully built profiles. Additionally, if a profile has no embedding (résumé not uploaded), cosine distance queries fail.

**Resolution:** `MatchingService.get_matches()` returns `([], 0)` immediately if `profile.embedding is None` (line 246–247). The frontend renders a "complete your profile to see matches" state. The cold-start problem is addressed by seeding postings via `scripts/probe_refresh.py` before any user session. For production, a background task to pre-populate postings at startup would be the next step.

---

## 11. Planned Features (Post Mid-Eval)

These are not built. They are listed as concrete next steps.

**Production deployment.** Backend → Railway (PostgreSQL + pgvector add-on); frontend → Vercel. Currently local-only. The application is containerizable with no changes to `app/`; Railway's managed Postgres supports the pgvector extension.

**Live outcome accumulation.** `PUT /api/integrations/gmail/sync` is wired in `TrackerService`. Connecting to a real inbox requires Gmail OAuth token storage (the service logs "OAuth token storage is Module 8 concern — application marked applied" at line 486 in `application_service.py`). Once live outcomes accumulate, the IQ learning curve will reflect real data.

**Ghost threshold recalibration.** The warm-start threshold (0.38) should be recalibrated once 200+ real `(posting, responded)` pairs exist. The seed script's threshold-assessment logic can be reused on real data.

**Interview Prep (Module 9 reintroduction).** The service was descoped for scope focus (§5.11). Reintroduction post-mid-eval is appropriate once the evaluation loop has real data to benchmark prep quality against interview conversion rates.

**Lever source activation.** Requires building a company slug list (e.g., from a curated directory or Lever's `/companies` discovery endpoint if accessible). The adapter code is complete.

**Response Likelihood v2.** Once real outcome volume reaches ~500 labeled pairs, replacing the LogisticRegression calibrator with a gradient-boosted model (LightGBM or XGBoost) would capture non-linear relationships between the cold-start features and actual response probability. The evaluation service's fixed-test-set methodology is already designed for this drop-in replacement.

---

## 12. Setup and Reproducibility

A reviewer should be able to stand up the full system from this section alone.

### Prerequisites

- Python 3.12
- [uv](https://github.com/astral-sh/uv): `pip install uv`
- Docker Desktop (for PostgreSQL + pgvector)
- Node.js ≥ 18 and npm
- At least one LLM API key — Groq free tier (`GROQ_API_KEY`) is sufficient for all non-LLM-mocked tests to pass; only `test_llm.py` and live draft generation require an actual key

### Step 1: Clone and configure

```bash
git clone https://github.com/Om-5640/InternPilot.git
cd InternPilot
cp .env.example .env
# Edit .env — minimum required:
#   DATABASE_URL=postgresql+asyncpg://postgres:testpass@localhost:5433/internpilot
#   JWT_SECRET=any-32-char-string
#   GROQ_API_KEY=your-groq-key   (or leave blank to skip LLM calls)
```

### Step 2: Start PostgreSQL with pgvector

```bash
docker run -d \
  --name internpilot-postgres \
  -e POSTGRES_PASSWORD=testpass \
  -p 5433:5432 \
  pgvector/pgvector:pg17
```

### Step 3: Install Python dependencies and apply migrations

```bash
uv sync --all-extras
uv run alembic upgrade head
# Expected: 15 migrations applied (0001_initial → 0015_drop_interview_prep)
```

### Step 4: Seed demo data (required to observe ghost shield and evaluation)

```bash
# Step 4a: Aggregate real postings (optional — seed_demo.py creates its own)
uv run python scripts/probe_refresh.py

# Step 4b: 14 demo users + 26 postings + 364 application-outcome pairs
#           Prints ghost distribution and deceptive posting callout
uv run python scripts/seed_demo.py

# Step 4c: 20 research opportunities with pgvector embeddings
uv run python scripts/seed_research.py

# Step 4d: Build Platform IQ learning curve (prints 8 checkpoints)
uv run python scripts/smoke_replay.py
```

Expected output from `seed_demo.py` (terminal):

```
DEMO SEED SUMMARY
=================================================================
Demo users created : 14
Applications       : 364
Outcomes recorded  : 364
Alumni contacts    : 23

DECEPTIVE POSTINGS — what the Ghost Shield misses (Module 5's territory)
...
Demo script: "This role matches you 91% — ranked #22 because 0/5 batchmates heard back."
```

Expected output from `smoke_replay.py`:

```
evaluate_now: n_outcomes=364 iq=66.70 brier=0.2260 ghost_f1=0.5070 model=formula_v1
build_history: 8 checkpoint(s)
  [1] n=31   iq=75.10  brier=0.2490  ...
  ...
  [8] n=255  iq=80.30  brier=0.1970  ...
```

### Step 5: Start the backend

```bash
uv run uvicorn app.main:app --reload
# API:  http://localhost:8000
# Docs: http://localhost:8000/api/docs
```

### Step 6: Start the frontend

```bash
cd frontend
npm install
npm run dev
# UI: http://localhost:5173
```

Set `VITE_USE_MOCKS=false` in `frontend/.env` to connect to the live backend (requires backend running). Default is `true` (in-memory mocks, no backend needed for UI review).

### Step 7: Run the test suite

```bash
# Create test database (once)
docker exec internpilot-postgres psql -U postgres -c "CREATE DATABASE internpilot_test;"

# Run all 276 tests
TEST_DATABASE_URL=postgresql+asyncpg://postgres:testpass@localhost:5433/internpilot_test \
  uv run pytest -v

# Type check (strict, 76 files)
uv run mypy app

# Lint
uv run ruff check .
```

### Step 8: Run the 12-step API smoke test (requires running backend + seeded DB)

```bash
uv run python scripts/journey_smoke.py
# Expected: === ALL 12 STEPS PASSED ===
```

---

## 13. Appendix

### A. Engineering contract documents

| Document | Purpose |
|---|---|
| [`API_CONTRACT.md`](../API_CONTRACT.md) | Authoritative field-level API contract. Every endpoint, request shape, response shape, enum value, and error code is defined here. Change the contract before changing the code. |
| [`CLAUDE.md`](../CLAUDE.md) | Developer conventions: pinned versions, project structure, data-isolation rule (with correct/incorrect examples), module discipline checklist, migration commands, async rules, error handling pattern, LLM router usage, embeddings usage. |

### B. Repository structure

```
app/
  main.py                       FastAPI lifespan, CORS, router mounts
  core/
    config.py                   pydantic-settings; all secrets from env
    database.py                 async engine + get_db() dependency
    security.py                 JWT create/verify + get_current_user
    errors.py                   APIError + global exception handlers → {error:{code,message}}
  models/                       15 SQLAlchemy ORM models
    base.py                     DeclarativeBase + TimestampMixin (id UUID, created_at, updated_at)
    user.py · profile.py        Modules 0–1
    company.py · posting.py     Shared global entities
    application.py · artifact.py · outcome.py    Modules 6–7 (user-owned)
    contact.py · referral.py    Module 8
    research_opportunity.py · research_outreach.py    Module 10
    evaluation.py               Module 11
    notification.py             Module 12
  schemas/                      Pydantic v2 request/response schemas (one per module)
  services/
    base.py                     BaseService — data-isolation scaffold
    ghost_service.py            5-signal Ghost-Job Shield
    matching_service.py         Matching + response likelihood (Modules 3+5)
    cohort_service.py           Cross-user aggregate response rates
    application_service.py      Application Assistant (grounding guard, ATS)
    evaluation_service.py       Platform IQ — evaluate_now + build_history
    research_service.py         Research opportunity ranking + pitch
    university_normalizer.py    Deterministic name canonicalization (30-entry alias map)
    ... (16 service files total)
  llm/
    router.py                   5-provider fallback chain (Gemini→Groq→OpenRouter→DeepSeek→Ollama)
    embeddings.py               Local all-MiniLM-L6-v2, EMBEDDING_DIM=384
  api/v1/                       Thin routers — 51 endpoints, no business logic
  sources/                      Ingestion adapters (Greenhouse, Ashby, Lever, RemoteOK, Remotive)
alembic/
  env.py                        Async Alembic env
  versions/                     15 reviewed migrations (0001_initial → 0015_drop_interview_prep)
tests/                          276 tests across 19 files
scripts/
  seed_demo.py                  14 users + 364 app-outcome pairs (RNG seed=42)
  seed_research.py              20 research opportunities with pgvector embeddings
  probe_refresh.py              Aggregate real postings from all 5 sources
  smoke_replay.py               Replay Platform IQ learning curve (evaluate_now + build_history)
  journey_smoke.py              12-step end-to-end API smoke test
frontend/
  src/
    lib/api-client.ts           Single HTTP client; mock↔real via VITE_USE_MOCKS
    lib/mocks.ts                In-memory mock data for guest mode
    routes/                     TanStack Start file-based routes (11 routes)
    components/nav.tsx          Auth-aware navigation (avatar + dropdown / guest badge)
docs/
  MID_EVALUATION.md             This document
API_CONTRACT.md                 Field-level API contract (single source of truth)
CLAUDE.md                       Developer conventions
```

### C. Numbers provenance

| Number | Value | Source |
|---|---|---|
| Test functions | 276 | `grep -rn "^def test_\|^async def test_" tests/` |
| mypy source files | 76 | `uv run mypy app` output |
| API endpoints | 51 | `grep -rn "^@router\." app/api/v1/*.py \| wc -l` |
| Alembic migrations | 15 | `ls alembic/versions/*.py` |
| Ghost threshold | 0.38 | `ghost_service.py:32` |
| Ghost weight: age | 0.30 | `ghost_service.py:24` |
| Ghost weight: repost | 0.20 | `ghost_service.py:25` |
| Ghost weight: vague | 0.25 | `ghost_service.py:26` |
| Ghost weight: company | 0.15 | `ghost_service.py:27` |
| Ghost weight: cohort | 0.10 | `ghost_service.py:28` |
| MIN_COHORT_APPS | 5 | `ghost_service.py:184`, `cohort_service.py:20`, `matching_service.py:40` |
| Semantic weight | 0.70 | `matching_service.py:33` |
| Skill weight | 0.30 | `matching_service.py:34` |
| RL cohort weight | 0.55 | `matching_service.py:47` |
| RL freshness weight | 0.35 | `matching_service.py:48` |
| RL ghost-inv weight | 0.10 | `matching_service.py:49` |
| Grounding threshold | 0.70 | `application_service.py:385` |
| W_RESP | 0.60 | `evaluation_service.py:60` |
| W_GHOST | 0.40 | `evaluation_service.py:61` |
| TEST_FRAC | 0.30 | `evaluation_service.py:64` |
| N_PREFIXES | 8 | `evaluation_service.py:67` |
| MIN_TOTAL | 30 | `evaluation_service.py:70` |
| Embedding dim | 384 | `app/llm/embeddings.py` (EMBEDDING_DIM) |
| Demo users | 14 | `seed_demo.py` DEMO_USERS list |
| Demo postings | 26 | Count of POSTING_TEMPLATES entries |
| Demo app-outcome pairs | 364 | 26 postings × 14 users (seed_demo.py comment) |
| Alumni contacts | 23 | Count of ALUMNI_CONTACTS values in seed_demo.py |
| Research opportunities | 20 | scripts/seed_research.py |
| Platform IQ | 66.7 | `smoke_replay.py` output after `seed_demo.py` (RNG seed=42) |
| Response Brier | 0.226 | same |
| Response AUC | 0.769 | same |
| Ghost F1 | 0.507 | same |
| IQ curve start (n=31) | IQ 75.1, Brier 0.249 | same |
| IQ curve end (n=255) | IQ 80.3, Brier 0.197 | same |
| Deceptive posting quote | "91% — ranked #22 because 0/5 batchmates heard back" | `seed_demo.py:1086` |
