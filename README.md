# MAATI — Village Relocation Management System

**A field-operations backend for the relocation of villages out of a tiger reserve — 105 REST endpoints over MongoDB, an AI fraud-detection pipeline that validates geo-tagged field evidence, and a schema-grounded AI agent that answers officials' questions by writing and running its own database queries.**

---

## Table of Contents
- [The Problem](#the-problem)
- [Our Solution](#our-solution)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [AI System #1 — Fraud Verification](#ai-system-1--fraud-verification)
- [AI System #2 — The Analytics Agent](#ai-system-2--the-analytics-agent)
- [Advanced Architectural Patterns](#advanced-architectural-patterns)
- [API Surface](#api-surface)
- [Getting Started](#getting-started)

---

## The Problem

The Forest Department must relocate **19 villages** situated inside a tiger reserve. This is a legally-governed, multi-year process involving public funds, court scrutiny, and audit — and before this system, it ran entirely on paper files.

A single village relocation means tracking, simultaneously:

- **10–15 official stages per village** — Gram Sabha consent, land identification, compensation approval, and so on, each of which must be completed in order.
- **Hundreds of families**, each headed by a *mukhiya*, each choosing **Option 1** (a government-built house) or **Option 2** (cash compensation, disbursed through the Collector's account into a joint account, then split across house purchase, fixed deposit, and household needs).
- **Physical construction** — plots, houses, and community facilities, each with its own ordered stage sequence.
- **Continuous photographic evidence** for every claim of progress.

Four failures follow from doing this on paper, and they compound:

1. **Evidence is unfalsifiable.** A field officer submits a photo captioned "foundation complete." Nothing ties that image to *that plot*, on *that date*, showing *that stage*. A photo taken 40 km away, or last year, or of a different house, is indistinguishable from a real one.
2. **Progress has no single source of truth.** Stages live in separate registers, so "how far along is Village X?" has no answer anyone can defend in an audit.
3. **Field staff work where there is no network.** Data is captured at the relocation site, frequently with no connectivity, and reconciled later — so the system must tolerate delayed submissions without corrupting the record.
4. **The people who need answers cannot query the data.** A Collector asking "which villages still have families on Option 1?" must route the question through whoever can write a database query. The answer arrives days later, if at all.

The hard part is not storing the data. It is making a distributed, intermittently-connected, human-entered record **trustworthy enough to audit** — and then making it **answerable in plain language**.

---

## Our Solution

MAATI is a three-surface system — a **Flutter Android app** for field officers, a **React dashboard** for senior officers, and this **Flask + MongoDB backend** tying them together. The backend treats every field submission as a **claim requiring verification**, and layers a natural-language query agent on top of the verified record.

- **Every stage update is evidence-bound.** A submission carries GPS coordinates, a timestamp, and a photo. An automated pipeline checks all three — including a vision model that reads the construction stage straight from the image — and attaches a `fraudScore` before any human looks at it.
- **Relocation is modeled as explicit stage machines.** Villages, plots, houses, and facilities each carry `currentStage` and `stagesCompleted[]`, with predecessor stages enforced, so progress is a queryable property of the record rather than a status someone reports.
- **Approvals are a role-gated ladder.** Verifications climb RA → RO → AD, each transition permitted only to the matching role and appended to an immutable `statusHistory`.
- **Nothing is ever destroyed.** Soft deletes and a global audit log mean a correction is always distinguishable from an omission.
- **Officials query in plain English.** The AI agent translates a question into MongoDB queries against a fixed schema, runs them, and returns a chart, table, or text answer for the dashboard.

Two AI systems solve opposite problems: **#1 is vision plus rules, for trust. #2 is language plus queries, for insight.**

---

## Tech Stack

### Backend
- **Python 3 / Flask 3.1** — REST API, blueprint-per-domain routing
- **MongoDB** (PyMongo, TLS) — primary datastore
- **Pydantic v2** — request-body validation with `extra = "forbid"`, rejecting unknown fields at the edge
- **Flask-JWT-Extended / bcrypt** — token auth and password hashing

### AI Layer
- **Google Gemini** (`google-genai`) — reasoning and query synthesis
- **MongoDB prompt cache** — deterministic replay for a fixed prompt set
- **ThreadPoolExecutor** — parallel fan-out of independent queries within a round

### Storage & Infrastructure
- **AWS S3** (boto3) — private photo/document storage, presigned URLs, size caps
- **gunicorn** — WSGI server in production (hosted on Render)
- **MongoDB Atlas** — TLS via `certifi` CA bundle
- **SMTP** — email OTP delivery for onboarding

### Client Surfaces *(separate repos/branches)*
- **React 19 + Vite + Tailwind + Recharts** — senior-officer dashboard (`frontend` branch)
- **Flutter (Dart 3)** — MAATI field app for officers; Retrofit-over-Dio typed client, English/Hindi localization, CI-built APKs via GitHub Actions

---

## Architecture

### Domain Blueprints

The API is split by domain, each mounted as a Flask blueprint in `backend.py`:

| Blueprint | Responsibility |
|---|---|
| `auth` | Login, OTP, JWT issuance, role assignment |
| `village` / `villageStages` | Village master records and stage progression |
| `family` | Families, `members[]`, relocation option selection |
| `plots` / `plotsVerification` | Plot allocation and field-verified stage updates |
| `admin/community` (buildings) | Community buildings and their stage machines |
| `facilities` / `facilityVerification` | Facility records and verified updates |
| `material` / `materialUpdates` | Construction material master list and consumption |
| `employee` / `admin` | Staff records, role management, village assignment |
| `meeting` / `complaints` | Gram Sabha meetings and grievance intake |
| `analytics` | Aggregated dashboard reporting |
| `logs` | Immutable action audit trail |
| `document` | S3 presigned upload / retrieval |
| `ai_agent` | Conversational query endpoints |

### Request Flow — a verified field update

```
Field App (offline capture: photo + GPS + timestamp)
  │
  ├─ POST /document/upload ────────────► S3 (size-capped, extension-allowlisted)
  │
  ▼
[Auth Layer]  @auth_required → JWT decode → role + userId claims
  │
  ▼
[Pydantic Model]  extra="forbid" → unknown/malformed fields rejected
  │
  ▼
[Verification Pipeline]  utils/verificationPipeline.py
  │   ├─ Haversine geo-check: photo GPS vs. registered plot coordinates
  │   ├─ Temporal check: submission time within the allowed window
  │   └─ Gemini vision check: does the image depict the claimed stage?
  │
  ├── fail ──► flagged as suspicious, retained for human review
  └── pass ──► stage committed: currentStage advanced, stagesCompleted[] appended
                │
                ▼
        [Logs] immutable audit entry (actor, action, timestamp)
```

### AI Query Flow

```
Official's question ("Bar chart of family count per district")
  │
  ▼
POST /ai/chat  →  @auth_required  →  session loaded from chat_sessions
  │
  ├─ prompt cache hit? ──► stored final_payload returned (deterministic replay)
  │
  ▼
[Executor Loop]  routes/ai_agent/executor.py — up to 4 rounds
  │
  ├─► [Agent]  Gemini + schema-grounded prompt, temperature 0.1
  │        └─ returns ONE JSON envelope: {queries|final|give_up}
  │
  ├─► [Protocol]  strict envelope validation
  │        ├─ collection ∈ ALLOWED_COLLECTIONS (11 collections)
  │        ├─ op ∈ {find, aggregate}  ← reads only, no writes reachable
  │        └─ limit clamped to ≤ 500 docs
  │
  ├─► [Query Batch]  ≤5 queries executed in PARALLEL (ThreadPoolExecutor)
  │        └─ BSON → JSON coercion (ObjectId, datetime, Decimal128)
  │
  └─► results fed back as a user turn → agent loops or emits `final`
           │
           ▼
   final_payload: {bar_chart | pie_chart | table | text}
           │
           ▼
   persisted to session + `trace` returned for UI transparency
```

---

## AI System #1 — Fraud Verification

**File:** `utils/verificationPipeline.py`

Every field submission is scored for trustworthiness *before* a human reviews it. Three **independent, orthogonal** checks run against each one:

| Check | Function | Rule |
|---|---|---|
| **Geo-fence** | `validate_geo` | Haversine great-circle distance between the photo's GPS and the plot's registered coordinates must be **≤ 50 m** |
| **Freshness** | `validate_time` | Capture timestamp must be **within 24 hours** of submission (IST) |
| **Vision** | `classify_stage` | Gemini reads the photo and classifies the construction stage; it must **match the stage the officer claimed** |

```
fraudScore = (geo failed) + (time failed) + (stage mismatch)     # 0–3
flag       = fraudScore > 0
```

`geoFlag`, `timeFlag`, `stageFlag`, `fraudScore`, and `flag` are stored **on the verification record**, so a reviewer sees immediately which submissions are suspicious and precisely why.

**Design decisions worth noting:**
- **Constrained output for determinism.** The vision prompt demands *only* a stage ID — no explanation, no punctuation — and `UNKNOWN` when uncertain. Shrinking the output space makes the classifier reliably parseable.
- **Cheap signals first.** Geo and time are deterministic and free; the vision model is the expensive-but-smart layer. Three orthogonal signals beat one heavy model.
- **It augments humans, it does not replace them.** The pipeline flags; a human still approves. That is the correct posture for a government accountability context.

---

## AI System #2 — The Analytics Agent

**Directory:** `routes/ai_agent/`

The agent is not a text-to-SQL wrapper, and it has **no fixed set of tools**. It is a **bounded agentic loop** that plans, writes its own MongoDB queries, inspects the results, and re-queries until it can answer — with every step constrained by a validating protocol layer.

> **Why no fixed tools?** Hardcoded functions like `get_village_overview()` only answer questions someone anticipated in advance. Letting the model compose arbitrary queries answers questions nobody predicted — but it means the model could propose a *dangerous* query. The protocol layer exists precisely to make that impossible.

### Design

**1. Envelope protocol — the model gets exactly one move per turn.**
Every response must be a single JSON object with exactly one of `queries`, `final`, or `give_up`. `protocol.py` parses it in isolation — no I/O, no Gemini calls, no Mongo — which makes the entire contract unit-testable. Malformed output raises `EnvelopeError` and degrades to a readable message rather than a stack trace.

**2. Schema grounding instead of introspection.**
The agent never sees the live database. It is given a hand-written schema description (`schema.py`) listing collections, field names, and types. This keeps the prompt small and stops the model inventing fields. `chat_sessions` is deliberately excluded from the schema *and* the allowlist — the agent cannot read other users' conversations.

**3. Read-only by construction.**
Enforcement is defense-in-depth. The allowlist and `op` check run in `protocol.py` at parse time, then **again** in `executor.py` at execution time (`_execute_or_reject`). Only `find` and `aggregate` are reachable — there is no code path from agent output to a write. Result sets are hard-capped at 500 documents.

**4. Parallel query fan-out.**
A question like *"which 5 villages have the most families?"* needs several independent lookups. The agent may request up to 5 per round; the executor dispatches them concurrently via `ThreadPoolExecutor` and returns them as one batch, so a multi-part question costs one round-trip of latency rather than five.

**5. Bounded convergence.**
`MAX_OUTER_ROUNDS = 4` caps the loop. Exhausting it returns an honest "couldn't converge, please narrow the question" rather than looping or fabricating. `give_up` is a first-class outcome: the agent is instructed to admit missing data instead of inventing it.

**6. Dual-representation history.**
Assistant turns are persisted as the full JSON `final_payload` so the frontend can re-render charts and tables on reload. Before being sent back to Gemini, that JSON is stripped to its plain `summary` — the model sees clean conversational text, never its own serialized output. Query traces are stored alongside but withheld from the model's context.

**7. Transparent traces.**
Every response carries a `trace`: each query's intent, the exact query executed, and its outcome. Users can see *why* an answer says what it says — which matters when the audience is auditors.

### Structure

| File | Role |
|---|---|
| `agent.py` | Gemini invocation (temperature 0.1 for reproducibility) |
| `protocol.py` | Envelope parsing, validation, result formatting — pure, no I/O |
| `schema.py` | Collection schemas + `ALLOWED_COLLECTIONS` allowlist |
| `executor.py` | Outer loop, parallel query execution, BSON coercion |
| `prompt_agent.py` / `prompt_reasoner.py` | System prompts |
| `sessions.py` | Chat persistence, title generation, role mapping |
| `routes.py` | HTTP surface, auth, prompt cache |

---

## Advanced Architectural Patterns

### 1. Evidence-Bound Verification
**Challenge:** A photo alone proves nothing. Field submissions arrive from staff who may be mistaken, rushed, or occasionally motivated to misreport.

**Solution:** Three independent signals must agree before a stage advances — **Haversine geo-distance** between photo GPS and registered plot coordinates, a **timestamp window** check, and a **Gemini vision** check that the image actually depicts the claimed construction stage. Failures are flagged and retained for human review, never silently dropped. Trust is derived from corroboration, not from the submitter's word.

### 2. Read-Only Agent Sandbox
**Challenge:** An LLM emitting database queries against production data is a write-access and data-exfiltration risk.

**Solution:** A validating protocol layer sits between the model and the database, enforcing a **collection allowlist**, an **operation allowlist** (`find`/`aggregate` only), and a **result cap** — checked at both parse time and execution time. The model produces a *proposal*; the executor decides what actually runs. No agent output can reach a write operation.

### 3. Deterministic Prompt Cache
**Challenge:** Live demos to government stakeholders cannot depend on LLM nondeterminism or API availability, but the system must still be genuinely live.

**Solution:** A curated prompt set is precomputed into a `prompt_cache` collection (`scripts/populate_prompt_cache.py`). Exact matches return a stored `final_payload` — identical every time, with zero API dependency — while every other question runs the full agentic loop. Reliability where it is needed, generality everywhere else.

### 4. Validate-at-the-Edge with Pydantic
**Challenge:** Field-submitted payloads from multiple clients drift over time; MongoDB's flexibility means bad shapes persist silently and corrupt later aggregations.

**Solution:** Pydantic models with `extra = "forbid"` reject unknown fields outright at the boundary. Malformed data is refused on entry rather than discovered months later in a report.

### 5. Soft Deletes as an Audit Primitive
**Challenge:** In a government workflow, "this record was removed" is itself auditable information. A hard delete destroys the trail.

**Solution:** Records carry a `deleted` boolean and are filtered at query time. Nothing is ever physically removed, so a correction is always distinguishable from an omission — and both remain reviewable.

### 6. Role-Gated Approval State Machine
**Challenge:** "Approved" must mean a specific person at a specific rank signed off — and that record must survive scrutiny years later.

**Solution:** Verifications climb a **multi-level ladder** enforced server-side by `STATUS_TRANSITIONS`:

```
Range Assistant (ra):  status 1 → 2
Range Officer   (ro):  status 2 → 3
Assistant Director(ad):status 3 → 4   (final)
```

A user may only act on a record whose **current status matches their role's expected status** — an RA cannot approve something already at the RO stage, and vice versa. Body `status` is `+1` (advance) or `-1` (send back), clamped to `[1, 4]`. **Freeze semantics** prevent editing once `status ≥ 3` and deletion once `status ≥ 2`, and every transition appends to an immutable `statusHistory` (who, what, when, comments).

### 7. Race-Free Human-Readable IDs
**Challenge:** Officials need IDs they can read aloud in a meeting (`plot_VILL_3_B001_4`), not ObjectIds — but naive counters race under concurrency.

**Solution:** A dedicated `counters` collection using MongoDB's atomic **`find_one_and_update` with `$inc` + upsert**. Counters are **scoped per parent** (per-village family counters, per-plot verification counters), yielding readable hierarchical IDs that remain correct under concurrent writes.

### 8. Dual-Delivery JWT Auth
**Challenge:** One auth system must serve a mobile app and a browser, which have opposite security constraints.

**Solution:** One JWT (HS256), two delivery mechanisms. Mobile receives the token in the response body and returns it as a `Bearer` header; web receives an **httponly, secure, SameSite=None cookie** so JavaScript cannot read it (XSS-resistant). The `@auth_required` decorator accepts whichever is present. **Authorization is a separate layer** from authentication — role helpers and `STATUS_TRANSITIONS` gate what an authenticated user may actually do.

### 9. Private-by-Default Object Storage
**Challenge:** Field photos are evidence in a public-funds process; they cannot sit behind guessable public URLs, and the API should not proxy large files.

**Solution:** Uploads are extension-allowlisted (`jpg/jpeg/png/pdf/csv`), size-capped at **1 MB**, and stored under opaque `uploads/<uuid>.<ext>` keys, with **transactional rollback** deleting earlier objects if any file in a batch fails. Retrieval mints a **presigned GET URL valid for 1 hour**, so objects stay private and clients fetch S3 directly.

### 10. Stage Machines Over Status Fields
**Challenge:** "Percent complete" typed in by hand is unverifiable and drifts from reality.

**Solution:** Each entity carries `currentStage` plus an append-only `stagesCompleted[]`. Progress becomes a **derived, queryable property** of the record, so village-level dashboards and the AI agent read the same ground truth as the field app.

---

## API Surface

**105 endpoints** across 20+ blueprints. All application routes require a valid JWT via `@auth_required`, which injects `claims` (including `userId` and role).

Representative AI endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/ai/chat` | Ask a question; returns chart/table/text + trace |
| `GET` | `/ai/chat-sessions` | List the caller's sessions |
| `POST` | `/ai/chat-sessions` | Create a session |
| `GET` | `/ai/chat-sessions/<id>` | Load full history |
| `PUT` | `/ai/chat-sessions/<id>` | Rename / replace messages |
| `DELETE` | `/ai/chat-sessions/<id>` | Delete a session |

Sessions are scoped by `userId` on every read, update, and delete.

**Response envelope** — uniform across the API:
```json
{ "error": false, "message": "...", "result": {} }
```

---

## Getting Started

```bash
pip install -r requirements.txt
```

Create a `.env` in the project root — it is gitignored and must never be committed:

```env
MONGO_URI=mongodb+srv://...
DB_NAME=...
JWT_SECRET=...
JWT_EXPIRE_MIN=...
OTP_EXPIRE_MIN=...

# S3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=...
BUCKET_NAME=...

# Gemini
GEMINI_API=...
GEMINI_MODEL=gemini-2.0-flash

# SMTP
SENDER_EMAIL=...
APP_PASSWORD=...
```

Run:
```bash
python backend.py
```

Optional helper scripts:
```bash
python scripts/seed_data.py             # seed sample collections
python scripts/populate_prompt_cache.py # precompute cached prompts
```

---

**Last Updated**: September 2026
