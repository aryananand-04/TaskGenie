# TaskGenie

**A codebase-grounded agent that turns a one-line intern task into a
file-specific, executable plan — and can open the real GitHub issue for it.**

Instead of vaguely rephrasing *"fix the search,"* TaskGenie connects to a real
GitHub repo, semantically retrieves the relevant code, runs a tool-using agent
that reads files and asks clarifying questions when needed, and produces a plan
that cites actual files and line numbers. Quality is measured by an automated
eval harness, not vibes.

---

## What makes it more than an LLM wrapper

| Capability | How |
|---|---|
| **Grounding (RAG)** | Embeds a GitHub repo (Gemini `text-embedding-004`) into a vector store and retrieves relevant code per task |
| **Agentic** | A tool-using loop (Groq function calling) that runs `search_code` / `read_file`, asks clarifying questions, then `finalize_plan` |
| **Actionable** | One click files a real GitHub issue with the subtasks as a checklist |
| **Measured** | An LLM-as-judge eval harness scores groundedness / clarity / actionability, with a RAG-on vs RAG-off comparison |
| **Resilient** | Multi-provider routing (Groq → Gemini), multi-model fallback, in-memory vector store fallback |

---

## Architecture

```
                       ┌──────────────────────────────────────────┐
   GitHub repo  ──────▶│  /api/index-repo                          │
                       │   fetch files → chunk → embed → vector DB │
                       └──────────────────────────────────────────┘
                                          │ (Upstash Vector or in-memory)
                                          ▼
  Vague task ─▶ /api/interngpt ─▶ Agent loop (Groq function calling)
                                   ├─ search_code  → vector retrieval
                                   ├─ read_file    → GitHub contents
                                   ├─ ask_clarifying_question → user
                                   └─ finalize_plan → { task, reasoning, subtasks }
                                          │
                                          ▼
                        UI: grounded plan + tool-call trace
                            ├─ Create GitHub issue → /api/create-issue
                            └─ Save to history (localStorage)

  Quality:  evals/run.mjs → app (RAG on & off) → Gemini judge → metrics table
```

## Tech stack

- **Next.js 15 / React 19 / Tailwind** — dashboard + API routes
- **Groq** (`llama-3.3-70b-versatile`) — agent + generation (primary)
- **Gemini** — fallback generation, embeddings, and the eval judge
- **Upstash Vector** — persistent vector store (optional; in-memory fallback)
- **GitHub REST** — repo reading + issue creation (no SDK, plain `fetch`)
- Plus a standalone **Python CLI** (`main.py`) for the simple flow

---

## Setup

You need at least a Groq or Gemini key; GitHub + Upstash unlock the full feature set.

| Key | Purpose | Free at |
|---|---|---|
| `GROQ_API_KEY` | Agent + generation (primary) | https://console.groq.com/keys |
| `GEMINI_API_KEY` | Fallback, embeddings, eval judge | https://aistudio.google.com/apikey |
| `GITHUB_TOKEN` | Read repos for RAG, create issues (`repo` scope) | https://github.com/settings/tokens |
| `UPSTASH_VECTOR_REST_URL` / `_TOKEN` | Persistent vectors (768-dim, COSINE) | https://console.upstash.com/vector |

### Web app (the full system)

```bash
cd frontend
npm install
cp .env.example .env.local   # paste your keys
npm run dev
```

Open <http://localhost:3000> → **Open Dashboard** → optionally connect a repo,
then enter a vague task.

### Python CLI (lightweight, Groq → Gemini)

```bash
pip install -r requirements.txt
cp .env.example .env          # paste your key(s)
python main.py
```

---

## Evals

With the dev server running and real keys set:

```bash
node evals/run.mjs
```

It indexes the dataset repo (and captures its real file list), then runs every
task twice — **grounded** (repo connected) and **ungrounded** (no repo) — and
reports two kinds of metric:

1. **Verified path accuracy** (deterministic, not gameable) — of the file paths
   an answer cites, the fraction that *actually exist* in the indexed repo.
   Hallucinated paths are checked against the real file list, so this measures
   correctness, not just specificity.
2. **LLM-as-judge** scores (groundedness / clarity / actionability) from Gemini
   at `temperature: 0`.

Honest scoping: both runs go through the **same agent** (Groq function calling);
the only difference is whether a repo is connected. So this measures *agent with
retrieval* vs *agent without it*, not *agent vs simple prompt*. Clarifying
questions are auto-answered once, then the row is skipped if still ambiguous, so
correct clarification isn't punished.

### Results

> Run `node evals/run.mjs` with real keys to populate this table — do not
> hand-fill it.

| Metric | Ungrounded | Grounded | Δ |
|---|---|---|---|
| verified path accuracy | _tbd_ | _tbd_ | _tbd_ |
| judge: groundedness | _tbd_ | _tbd_ | _tbd_ |
| judge: clarity | _tbd_ | _tbd_ | _tbd_ |
| judge: actionability | _tbd_ | _tbd_ | _tbd_ |

---

## Project layout

```
main.py                       Python CLI entry point
agents/, context/, feedback/  CLI pipeline (Groq → Gemini, keyword context)
frontend/src/app/api/
  interngpt/      agent-backed task clarification (RAG + tools)
  index-repo/     index a GitHub repo for retrieval
  create-issue/   open a GitHub issue from a plan
frontend/src/lib/
  rag/            github, chunk, embed, store, index, retrieve
  agent/          tools + tool-calling loop
  history.ts      localStorage task history
evals/            dataset + LLM-as-judge + runner
```

## Status

Working: RAG over a real repo, tool-using agent with clarifying questions,
GitHub issue creation, eval harness, multi-provider routing, task history.
Vector persistence requires Upstash (otherwise in-memory, resets on restart).
