// Vector store with two interchangeable backends behind one async interface:
//   - Upstash Vector  (used when UPSTASH_VECTOR_REST_URL/TOKEN are set) — persists
//   - In-memory cosine (default fallback) — resets on process restart
//
// Repos are isolated using Upstash namespaces (or a Map key in memory).

import { Index } from "@upstash/vector";

export type StoredChunk = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  text: string;
  vector: number[];
};

export type Match = Omit<StoredChunk, "vector"> & { score: number };

export function repoKey(owner: string, repo: string): string {
  return `${owner}/${repo}`.toLowerCase();
}

// ---- Upstash backend (lazy: only built when configured) --------------------

let upstash: Index | null | undefined;

function getUpstash(): Index | null {
  if (upstash !== undefined) return upstash;
  const url = process.env.UPSTASH_VECTOR_REST_URL;
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
  upstash = url && token ? new Index({ url, token }) : null;
  return upstash;
}

// Upstash namespaces can't contain "/", so encode the repo key.
function namespace(key: string): string {
  return key.replace(/[^a-z0-9_-]/gi, "_");
}

// ---- In-memory backend -----------------------------------------------------

const memory = new Map<string, StoredChunk[]>();

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ---- Public interface ------------------------------------------------------

export async function upsert(key: string, chunks: StoredChunk[]): Promise<void> {
  const index = getUpstash();
  if (index) {
    const ns = index.namespace(namespace(key));
    // Reset the namespace so re-indexing doesn't leave stale chunks.
    try {
      await ns.reset();
    } catch {
      // namespace may not exist yet — ignore
    }
    const BATCH = 100;
    for (let i = 0; i < chunks.length; i += BATCH) {
      await ns.upsert(
        chunks.slice(i, i + BATCH).map((c) => ({
          id: c.id,
          vector: c.vector,
          metadata: {
            path: c.path,
            startLine: c.startLine,
            endLine: c.endLine,
            text: c.text,
          },
        }))
      );
    }
    return;
  }
  memory.set(key, chunks);
}

export async function query(
  key: string,
  vector: number[],
  k = 6
): Promise<Match[]> {
  const index = getUpstash();
  if (index) {
    const ns = index.namespace(namespace(key));
    const res = await ns.query({ vector, topK: k, includeMetadata: true });
    return res.map((r) => {
      const m = (r.metadata ?? {}) as Record<string, unknown>;
      return {
        id: String(r.id),
        path: String(m.path ?? ""),
        startLine: Number(m.startLine ?? 0),
        endLine: Number(m.endLine ?? 0),
        text: String(m.text ?? ""),
        score: r.score,
      };
    });
  }

  const chunks = memory.get(key) ?? [];
  return chunks
    .map(({ vector: v, ...rest }) => ({ ...rest, score: cosine(vector, v) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
