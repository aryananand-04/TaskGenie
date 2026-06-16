// Sliding-window line chunker. Keeps chunks small enough to embed while
// preserving enough context (with overlap) to be useful for retrieval.

import type { RepoFile } from "./github";

const WINDOW = 60; // lines per chunk
const OVERLAP = 10; // lines shared between consecutive chunks

export type Chunk = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  text: string;
};

export function chunkFile(file: RepoFile): Chunk[] {
  const lines = file.content.split("\n");
  if (lines.length === 0) return [];

  const chunks: Chunk[] = [];
  const step = Math.max(1, WINDOW - OVERLAP);

  for (let start = 0; start < lines.length; start += step) {
    const end = Math.min(start + WINDOW, lines.length);
    const text = lines.slice(start, end).join("\n").trim();
    if (text.length > 0) {
      chunks.push({
        id: `${file.path}#${start + 1}`,
        path: file.path,
        startLine: start + 1,
        endLine: end,
        text,
      });
    }
    if (end === lines.length) break;
  }
  return chunks;
}

export function chunkRepo(files: RepoFile[]): Chunk[] {
  return files.flatMap(chunkFile);
}
