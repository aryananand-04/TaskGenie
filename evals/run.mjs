// TaskGenie eval harness.
//
// For every dataset task, runs the live app twice — grounded (repo connected)
// and ungrounded (no repo) — then reports two kinds of metric:
//   1. Deterministic "verified path accuracy": of the file paths the answer
//      cites, what fraction actually exist in the indexed repo. This CANNOT be
//      gamed by hallucinating plausible paths.
//   2. LLM-as-judge scores (groundedness / clarity / actionability) from Gemini.
//
// Both grounded and ungrounded runs go through the SAME agent (Groq function
// calling); the only difference is whether a repo is connected. So this measures
// "agent with repo retrieval" vs "agent without it", not agent-vs-simple-prompt.
//
// Prereqs:
//   1. The web app running:  cd frontend && npm run dev
//   2. Real keys in frontend/.env.local (GROQ, GEMINI, GITHUB)
//
// Usage:  node evals/run.mjs        (BASE_URL overridable)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";
import { judge } from "./judge.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Load GEMINI_API_KEY (env, else parse frontend/.env.local) --------------
function loadGeminiKey() {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "your_key_here") {
    return process.env.GEMINI_API_KEY;
  }
  try {
    const envPath = join(__dirname, "..", "frontend", ".env.local");
    const line = readFileSync(envPath, "utf-8")
      .split("\n")
      .find((l) => l.startsWith("GEMINI_API_KEY="));
    const val = line?.split("=")[1]?.trim();
    if (val && val !== "your_key_here") return val;
  } catch {
    /* ignore */
  }
  throw new Error("GEMINI_API_KEY not found (env or frontend/.env.local).");
}
const GEMINI_KEY = loadGeminiKey();

// --- Retry/backoff for rate limits ------------------------------------------
async function withRetry(fn, label, tries = 4) {
  let delay = 2000;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      const msg = String(err.message || err);
      const retryable = /429|rate|quota|HTTP 5\d\d|fetch failed|ECONN/i.test(msg);
      if (i === tries - 1 || !retryable) throw err;
      console.log(`   ↻ retry ${label} in ${delay}ms (${msg.slice(0, 70)})`);
      await sleep(delay);
      delay *= 2;
    }
  }
}

// --- App calls --------------------------------------------------------------
async function callApp(prompt, repo) {
  const res = await fetch(`${BASE_URL}/api/interngpt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, repo }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `interngpt HTTP ${res.status}`);
  return data;
}

async function indexRepo(repo) {
  const res = await fetch(`${BASE_URL}/api/index-repo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoUrl: repo }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `index-repo HTTP ${res.status}`);
  return data;
}

// Get a final plan, auto-answering a single clarifying question so that a
// (correct) clarification doesn't get scored as a bad answer. If it still wants
// clarification after one answer, mark the row to be skipped from averages.
async function getPlan(vague, repo) {
  let data = await withRetry(() => callApp(vague, repo), "interngpt");
  if (data.clarifyingQuestion) {
    const combined = `${vague}\n\nClarification: Proceed with your best assumption based on the codebase.`;
    data = await withRetry(() => callApp(combined, repo), "interngpt-clarify");
  }
  if (data.clarifyingQuestion) return { clarified: true };
  return { result: data };
}

// --- Deterministic path verification ----------------------------------------
const PATH_RE =
  /[\w./-]+\.(?:tsx|ts|jsx|js|mjs|cjs|py|md|mdx|json|ya?ml|css|scss|html|java|go|rb|rs|cpp|cc|c|h|sql)\b/gi;

function extractPaths(text) {
  const found = (text.match(PATH_RE) || []).map((p) =>
    p.replace(/^[./]+/, "").toLowerCase()
  );
  return [...new Set(found)];
}

function pathExists(cited, indexed) {
  return indexed.some(
    (ip) =>
      ip === cited ||
      ip.endsWith("/" + cited) ||
      basename(ip) === basename(cited)
  );
}

// Returns { cited, verified, accuracy } for the paths an answer references.
function verifyPaths(text, indexedPaths) {
  const cited = extractPaths(text);
  if (cited.length === 0) return { cited: 0, verified: 0, accuracy: 0 };
  const verified = cited.filter((p) => pathExists(p, indexedPaths)).length;
  return { cited: cited.length, verified, accuracy: verified / cited.length };
}

function resultToText(r) {
  const subs = (r.subtasks || []).map((s, i) => `${i + 1}. ${s}`).join("\n");
  return `Task: ${r.autocompleted_task}\n\nReasoning: ${r.reasoning}\n\nSubtasks:\n${subs}`;
}

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// --- Main -------------------------------------------------------------------
async function main() {
  const dataset = JSON.parse(readFileSync(join(__dirname, "dataset.json"), "utf-8"));
  console.log(`\nTaskGenie eval — ${dataset.length} tasks against ${BASE_URL}\n`);

  // Index every unique repo once, capturing its real file list.
  const indexed = new Map(); // repo -> string[] of paths (lowercased)
  for (const repo of [...new Set(dataset.map((d) => d.repo))]) {
    process.stdout.write(`Indexing ${repo} ... `);
    try {
      const r = await withRetry(() => indexRepo(repo), "index-repo");
      indexed.set(repo, (r.paths || []).map((p) => p.toLowerCase()));
      console.log(`${r.files} files, ${r.chunks} chunks`);
    } catch (err) {
      indexed.set(repo, []);
      console.log(`FAILED (${err.message})`);
    }
  }
  console.log("");

  const rows = [];
  let skipped = 0;
  for (const item of dataset) {
    process.stdout.write(`• ${item.id} ... `);
    try {
      const paths = indexed.get(item.repo) || [];
      const on = await getPlan(item.vague_task, item.repo);
      const off = await getPlan(item.vague_task, undefined);

      if (on.clarified || off.clarified) {
        skipped++;
        console.log("skipped (still needs clarification)");
        continue;
      }

      const onText = resultToText(on.result);
      const offText = resultToText(off.result);

      const onJudge = await withRetry(
        () => judge(GEMINI_KEY, item.vague_task, onText, item.notes),
        "judge"
      );
      const offJudge = await withRetry(
        () => judge(GEMINI_KEY, item.vague_task, offText, item.notes),
        "judge"
      );

      rows.push({
        id: item.id,
        on: { ...onJudge, paths: verifyPaths(onText, paths) },
        off: { ...offJudge, paths: verifyPaths(offText, paths) },
      });
      console.log(
        `grounded acc ${rows.at(-1).on.paths.accuracy.toFixed(2)} / ungrounded ${rows
          .at(-1)
          .off.paths.accuracy.toFixed(2)}`
      );
      await sleep(1000); // ease free-tier rate limits between rows
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
    }
  }

  if (rows.length === 0) {
    console.log(`\nNo rows scored (${skipped} skipped). Is the dev server running with real keys?`);
    return;
  }

  // Aggregate.
  const aggJudge = (k, c) => avg(rows.map((r) => r[c][k]));
  const aggAcc = (c) => avg(rows.map((r) => r[c].paths.accuracy));
  const aggCited = (c) => avg(rows.map((r) => r[c].paths.cited));

  const f = (n) => n.toFixed(2);
  console.log(`\n=== Results (n=${rows.length}, skipped=${skipped}) ===\n`);
  console.log("| Metric                      | Ungrounded | Grounded |   Δ    |");
  console.log("|-----------------------------|------------|----------|--------|");
  const line = (label, off, on) =>
    console.log(
      `| ${label.padEnd(27)} | ${f(off).padStart(10)} | ${f(on).padStart(8)} | ${((on - off >= 0 ? "+" : "") + f(on - off)).padStart(6)} |`
    );
  line("verified path accuracy ⭐", aggAcc("off"), aggAcc("on"));
  line("judge: groundedness", aggJudge("groundedness", "off"), aggJudge("groundedness", "on"));
  line("judge: clarity", aggJudge("clarity", "off"), aggJudge("clarity", "on"));
  line("judge: actionability", aggJudge("actionability", "off"), aggJudge("actionability", "on"));
  line("avg paths cited", aggCited("off"), aggCited("on"));

  const summary = {
    n: rows.length,
    skipped,
    grounded: {
      verified_path_accuracy: aggAcc("on"),
      groundedness: aggJudge("groundedness", "on"),
      clarity: aggJudge("clarity", "on"),
      actionability: aggJudge("actionability", "on"),
    },
    ungrounded: {
      verified_path_accuracy: aggAcc("off"),
      groundedness: aggJudge("groundedness", "off"),
      clarity: aggJudge("clarity", "off"),
      actionability: aggJudge("actionability", "off"),
    },
  };

  const outDir = join(__dirname, "results");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(outPath, JSON.stringify({ summary, rows }, null, 2));
  console.log(`\nSaved ${outPath}\n`);
}

main().catch((err) => {
  console.error("\nEval failed:", err.message);
  process.exit(1);
});
