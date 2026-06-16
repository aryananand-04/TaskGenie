// Minimal GitHub REST client (fetch-based, no dependency). Reads repo files for
// RAG indexing and creates issues. Token is read server-side only.

const GITHUB_API = "https://api.github.com";

// Extensions we treat as indexable source/text. Everything else is skipped.
const TEXT_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "py", "rb", "go", "rs", "java", "kt", "c", "cc", "cpp", "h", "hpp",
  "cs", "php", "swift", "scala", "sh",
  "md", "mdx", "txt", "json", "yaml", "yml", "toml",
  "css", "scss", "html", "sql",
]);

const SKIP_DIRS = ["node_modules/", ".git/", "dist/", "build/", ".next/", "vendor/"];
const MAX_FILE_BYTES = 100_000; // skip very large files
const MAX_FILES = 300; // cap total files indexed (free-tier friendly)

export type RepoRef = { owner: string; repo: string };
export type RepoFile = { path: string; content: string };

/** Accepts "owner/repo", a full URL, or a .git URL. */
export function parseRepoRef(input: string): RepoRef {
  const cleaned = input.trim().replace(/\.git$/, "");
  const urlMatch = cleaned.match(/github\.com[/:]([^/]+)\/([^/]+)/);
  if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2] };
  const shortMatch = cleaned.match(/^([^/]+)\/([^/]+)$/);
  if (shortMatch) return { owner: shortMatch[1], repo: shortMatch[2] };
  throw new Error(`Could not parse repo from "${input}". Use owner/repo or a GitHub URL.`);
}

function headers(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token && token !== "your_key_here") h.Authorization = `Bearer ${token}`;
  return h;
}

async function gh<T>(path: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: headers() });
  if (!res.ok) {
    throw new Error(`GitHub ${path} -> HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

function isIndexable(path: string, size: number): boolean {
  if (size > MAX_FILE_BYTES) return false;
  if (SKIP_DIRS.some((d) => path.includes(d))) return false;
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXTENSIONS.has(ext);
}

/** Fetch indexable text files from a repo's default branch. */
export async function fetchRepoFiles(ref: RepoRef): Promise<RepoFile[]> {
  const meta = await gh<{ default_branch: string }>(
    `/repos/${ref.owner}/${ref.repo}`
  );
  const tree = await gh<{
    tree: { path: string; type: string; sha: string; size?: number }[];
    truncated: boolean;
  }>(`/repos/${ref.owner}/${ref.repo}/git/trees/${meta.default_branch}?recursive=1`);

  const blobs = tree.tree
    .filter((n) => n.type === "blob" && isIndexable(n.path, n.size ?? 0))
    .slice(0, MAX_FILES);

  const files: RepoFile[] = [];
  for (const node of blobs) {
    try {
      const blob = await gh<{ content: string; encoding: string }>(
        `/repos/${ref.owner}/${ref.repo}/git/blobs/${node.sha}`
      );
      const content =
        blob.encoding === "base64"
          ? Buffer.from(blob.content, "base64").toString("utf-8")
          : blob.content;
      files.push({ path: node.path, content });
    } catch (err) {
      console.error(`[rag] skipped ${node.path}:`, err);
    }
  }
  return files;
}

/** Read a single file's contents by path (used by the agent's read_file tool). */
export async function fetchFileContent(
  ref: RepoRef,
  path: string
): Promise<string> {
  const data = await gh<{ content?: string; encoding?: string }>(
    `/repos/${ref.owner}/${ref.repo}/contents/${path}`
  );
  if (!data.content) throw new Error(`No content for ${path}`);
  const decoded =
    data.encoding === "base64"
      ? Buffer.from(data.content, "base64").toString("utf-8")
      : data.content;
  return decoded;
}

/** Find an open issue with an exact title match (for dedupe). */
export async function findOpenIssueByTitle(
  ref: RepoRef,
  title: string
): Promise<{ url: string; number: number } | null> {
  const issues = await gh<{ html_url: string; number: number; title: string; pull_request?: unknown }[]>(
    `/repos/${ref.owner}/${ref.repo}/issues?state=open&per_page=100`
  );
  const match = issues.find((i) => !i.pull_request && i.title === title);
  return match ? { url: match.html_url, number: match.number } : null;
}

/** Create a GitHub issue. Returns the issue's html_url. (Milestone 3.) */
export async function createIssue(
  ref: RepoRef,
  title: string,
  body: string,
  labels: string[] = ["taskgenie"]
): Promise<{ url: string; number: number }> {
  const res = await fetch(
    `${GITHUB_API}/repos/${ref.owner}/${ref.repo}/issues`,
    {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, labels }),
    }
  );
  if (!res.ok) {
    throw new Error(`GitHub create issue -> HTTP ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { html_url: string; number: number };
  return { url: data.html_url, number: data.number };
}
