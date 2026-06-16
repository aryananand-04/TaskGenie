"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addHistoryEntry, type TaskResult } from "@/lib/history";

const EXAMPLES = [
  "fix the search",
  "improve login",
  "the dashboard is slow",
  "add tests",
];

function resultToMarkdown(input: string, r: TaskResult): string {
  const lines = [
    `# ${r.autocompleted_task}`,
    "",
    `*Original task: ${input}*`,
  ];
  if (r.reasoning) lines.push("", "## Reasoning", r.reasoning);
  if (r.subtasks?.length) {
    lines.push("", "## Subtasks");
    r.subtasks.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  }
  return lines.join("\n");
}

export default function PromptInput() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TaskResult | null>(null);
  const [submittedInput, setSubmittedInput] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  // Agent: clarifying question + tool-call trace.
  const [clarify, setClarify] = useState("");
  const [clarifyAnswer, setClarifyAnswer] = useState("");
  const [trace, setTrace] = useState<string[]>([]);

  // GitHub issue creation.
  const [issuing, setIssuing] = useState(false);
  const [issueUrl, setIssueUrl] = useState("");
  const [issueError, setIssueError] = useState("");

  // RAG: optionally connect a GitHub repo for grounded answers.
  const [repo, setRepo] = useState("");
  const [indexing, setIndexing] = useState(false);
  const [indexStatus, setIndexStatus] = useState("");

  const handleIndex = async () => {
    if (!repo.trim()) return;
    setIndexing(true);
    setIndexStatus("");
    try {
      const res = await fetch("/api/index-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: repo.trim() }),
      });
      const data = await res.json();
      setIndexStatus(
        res.ok
          ? `Indexed ${data.files} files (${data.chunks} chunks) from ${data.repo}.`
          : data.error || "Indexing failed."
      );
    } catch {
      setIndexStatus("Error contacting the indexer.");
    }
    setIndexing(false);
  };

  const handleSubmit = async (override?: string) => {
    const task = (override ?? input).trim();
    if (!task) return;
    if (override) setInput(override);
    setLoading(true);
    setResult(null);
    setError("");
    setClarify("");
    setTrace([]);
    setDone(new Set());
    setCopied(false);
    setIssueUrl("");
    setIssueError("");

    try {
      const res = await fetch("/api/interngpt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: task, repo: repo.trim() || undefined }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed.");
      } else if (data.clarifyingQuestion) {
        // Agent needs more info before it can ground a plan.
        setClarify(data.clarifyingQuestion as string);
        setSubmittedInput(task);
        setTrace((data.trace as string[]) ?? []);
      } else {
        const taskResult = data as TaskResult;
        setResult(taskResult);
        setSubmittedInput(task);
        setTrace((data.trace as string[]) ?? []);
        addHistoryEntry(task, taskResult);
      }
    } catch {
      setError("Error contacting InternGPT.");
    }

    setLoading(false);
  };

  const handleClarifyAnswer = () => {
    if (!clarifyAnswer.trim()) return;
    const combined = `${submittedInput}\n\nClarification: ${clarifyAnswer.trim()}`;
    setClarifyAnswer("");
    handleSubmit(combined);
  };

  const handleCreateIssue = async () => {
    if (!result || !repo.trim() || issuing || issueUrl) return;
    setIssuing(true);
    setIssueUrl("");
    setIssueError("");
    try {
      const res = await fetch("/api/create-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: repo.trim(), result }),
      });
      const data = await res.json();
      if (!res.ok) setIssueError(data.error || "Could not create issue.");
      else setIssueUrl(data.url as string);
    } catch {
      setIssueError("Error contacting the issue creator.");
    }
    setIssuing(false);
  };

  const toggleDone = (i: number) => {
    setDone((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(
        resultToMarkdown(submittedInput, result)
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (e.g. non-secure context) — ignore silently.
    }
  };

  return (
    <div className="space-y-4">
      {/* Optional: connect a GitHub repo to ground answers in real code */}
      <div className="bg-white p-4 rounded-lg shadow border space-y-2">
        <label className="text-sm font-medium text-gray-700">
          Connect a GitHub repo (optional — grounds answers in real code)
        </label>
        <div className="flex gap-2">
          <Input
            placeholder="owner/repo or https://github.com/owner/repo"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            disabled={indexing}
          />
          <Button
            variant="outline"
            onClick={handleIndex}
            disabled={indexing || !repo.trim()}
          >
            {indexing ? "Indexing..." : "Index repo"}
          </Button>
        </div>
        {indexStatus && <p className="text-sm text-gray-600">{indexStatus}</p>}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Enter a vague task, e.g. 'fix the search'"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          disabled={loading}
        />
        <Button onClick={() => handleSubmit()} disabled={loading}>
          {loading ? "Thinking..." : "Submit"}
        </Button>
      </div>

      {/* Example chips — only before the first result */}
      {!result && !loading && !error && !clarify && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-gray-500 self-center">Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => handleSubmit(ex)}
              className="text-sm px-3 py-1 rounded-full border bg-white text-gray-700 hover:bg-gray-100"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white p-4 rounded-lg shadow border">
              <div className="h-4 w-40 bg-gray-200 rounded" />
              <div className="h-3 w-full bg-gray-100 rounded mt-3" />
              <div className="h-3 w-5/6 bg-gray-100 rounded mt-2" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Agent tool-call trace */}
      {trace.length > 0 && !loading && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-500 mb-1">Agent steps</p>
          <ol className="text-xs text-gray-600 font-mono space-y-0.5 list-decimal list-inside">
            {trace.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Clarifying question from the agent */}
      {clarify && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-amber-800">
              The agent needs a bit more detail:
            </p>
            <p className="text-amber-900 mt-1">{clarify}</p>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Your answer..."
              value={clarifyAnswer}
              onChange={(e) => setClarifyAnswer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleClarifyAnswer()}
            />
            <Button onClick={handleClarifyAnswer} disabled={!clarifyAnswer.trim()}>
              Answer
            </Button>
          </div>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-end items-center gap-2">
            {issueUrl && (
              <a
                href={issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-600 hover:underline mr-auto"
              >
                Issue created →
              </a>
            )}
            {issueError && (
              <span className="text-sm text-red-600 mr-auto">{issueError}</span>
            )}
            {repo.trim() && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateIssue}
                disabled={issuing || !!issueUrl}
              >
                {issuing
                  ? "Creating..."
                  : issueUrl
                    ? "Issue created"
                    : "Create GitHub issue"}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy as Markdown"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSubmit(submittedInput)}
            >
              Regenerate
            </Button>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border">
            <h3 className="font-semibold text-gray-900">Autocompleted Task</h3>
            <p className="text-gray-700 mt-1">{result.autocompleted_task}</p>
          </div>

          {result.reasoning && (
            <div className="bg-white p-4 rounded-lg shadow border">
              <h3 className="font-semibold text-gray-900">Reasoning</h3>
              <p className="text-gray-700 mt-1">{result.reasoning}</p>
            </div>
          )}

          {result.subtasks?.length > 0 && (
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Subtasks</h3>
                <span className="text-sm text-gray-500">
                  {done.size}/{result.subtasks.length} done
                </span>
              </div>
              <ul className="mt-2 space-y-1">
                {result.subtasks.map((sub, i) => (
                  <li key={i}>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={done.has(i)}
                        onChange={() => toggleDone(i)}
                        className="mt-1"
                      />
                      <span
                        className={
                          done.has(i)
                            ? "text-gray-400 line-through"
                            : "text-gray-700"
                        }
                      >
                        {sub}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
