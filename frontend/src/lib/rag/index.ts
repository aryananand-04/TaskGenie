// Orchestrates indexing a repo: fetch -> chunk -> embed -> store.

import { fetchRepoFiles, parseRepoRef, type RepoRef } from "./github";
import { chunkRepo } from "./chunk";
import { embedTexts } from "./embed";
import { repoKey, upsert, type StoredChunk } from "./store";

export type IndexResult = {
  repo: string;
  files: number;
  chunks: number;
  paths: string[]; // indexed file paths — used to verify cited paths in evals
};

export async function indexRepo(input: string): Promise<IndexResult> {
  const ref: RepoRef = parseRepoRef(input);
  const key = repoKey(ref.owner, ref.repo);

  const files = await fetchRepoFiles(ref);
  const chunks = chunkRepo(files);

  const vectors = await embedTexts(chunks.map((c) => c.text));
  const stored: StoredChunk[] = chunks.map((c, i) => ({
    ...c,
    vector: vectors[i],
  }));

  await upsert(key, stored);
  return {
    repo: key,
    files: files.length,
    chunks: stored.length,
    paths: files.map((f) => f.path),
  };
}
