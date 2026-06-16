// Retrieval: embed the task, find the most relevant code chunks, and render
// them as a citeable context block for the prompt.

import { embedOne } from "./embed";
import { parseRepoRef } from "./github";
import { repoKey, query, type Match } from "./store";

export async function retrieve(
  repoInput: string,
  task: string,
  k = 6
): Promise<Match[]> {
  const ref = parseRepoRef(repoInput);
  const key = repoKey(ref.owner, ref.repo);
  const vector = await embedOne(task);
  return query(key, vector, k);
}

/** Render matches as a context string the model can cite by file:line. */
export function renderContext(matches: Match[]): string {
  if (matches.length === 0) return "No matching code found in the indexed repo.";
  return matches
    .map(
      (m) =>
        `File: ${m.path} (lines ${m.startLine}-${m.endLine})\n` +
        "```\n" +
        m.text +
        "\n```"
    )
    .join("\n\n");
}
