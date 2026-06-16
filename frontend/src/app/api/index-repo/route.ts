import { NextRequest, NextResponse } from "next/server";
import { indexRepo } from "@/lib/rag";

// POST { repoUrl } -> fetch + chunk + embed + store the repo for RAG.
// Kept separate from the chat call so indexing never blocks a task request.
export async function POST(req: NextRequest) {
  let repoUrl: unknown;
  try {
    ({ repoUrl } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof repoUrl !== "string" || !repoUrl.trim()) {
    return NextResponse.json(
      { error: "Provide a repo as owner/repo or a GitHub URL." },
      { status: 400 }
    );
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || geminiKey === "your_key_here") {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY is required to build embeddings. Add a free key from https://aistudio.google.com/apikey.",
      },
      { status: 503 }
    );
  }

  try {
    const result = await indexRepo(repoUrl.trim());
    return NextResponse.json(result);
  } catch (err) {
    console.error("[index-repo] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Indexing failed." },
      { status: 502 }
    );
  }
}
