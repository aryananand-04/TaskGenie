import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { retrieve, renderContext } from "@/lib/rag/retrieve";
import { runAgent } from "@/lib/agent/agent";

// Provider chain: Groq (primary) → Gemini (fallback). Within each provider we
// also fall through a list of models if one is unavailable or rate-limited.
const GROQ_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
const GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
];

const PLACEHOLDER = "your_key_here";

const PROMPT = (task: string, context: string) => `You are an AI assistant helping an intern clarify vague software development tasks.

Vague Task: ${task}

Relevant code from the project (cite real file paths and line numbers when you use them):
${context}

Rewrite this as a detailed, actionable task an intern can execute, grounded in
the code above where relevant, and break it into concrete subtasks. When the
context contains a relevant file, reference it by path in your answer.

Respond ONLY with valid JSON in exactly this shape:
{
  "autocompleted_task": "<a clear, detailed version of the task>",
  "reasoning": "<why you interpreted it this way>",
  "subtasks": ["<step 1>", "<step 2>", "..."]
}`;

type TaskResult = {
  autocompleted_task: string;
  reasoning: string;
  subtasks: string[];
};

/** Extract the JSON object from a model response, tolerating code fences. */
function parseResponse(text: string): Partial<TaskResult> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in model response.");
  return JSON.parse(match[0]);
}

/**
 * Heuristic fallback that splits a task into steps when the model does not
 * supply its own subtasks. Port of agents/task_breakdown.py.
 */
function breakIntoSubtasks(detailedTask: string): string[] {
  if (!detailedTask?.trim()) return ["Break task into clear actionable steps."];
  const parts = detailedTask.split(/\n+|(?<=[.!?])\s+|;\s*|,\s+and\s+/);
  const steps = parts
    .map((p) => p.replace(/^[\s\-*\t]+|[\s\-*\t]+$/g, ""))
    .filter((p) => p.length > 3);
  return steps.length ? steps : ["Break task into clear actionable steps."];
}

function isUsableKey(key: string | undefined): key is string {
  return !!key && key !== PLACEHOLDER;
}

/** Call Groq's OpenAI-compatible chat endpoint. Returns raw model text. */
async function callGroq(
  model: string,
  prompt: string,
  apiKey: string
): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      // The word "JSON" appears in the prompt, satisfying Groq's json_object mode.
      response_format: { type: "json_object" },
      temperature: 0.4,
    }),
  });
  if (!res.ok) {
    throw new Error(`Groq ${model} HTTP ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

/** Call Gemini via the official SDK. Returns raw model text. */
async function callGemini(
  model: string,
  prompt: string,
  apiKey: string
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const m = genAI.getGenerativeModel({ model });
  const result = await m.generateContent(prompt);
  return result.response.text();
}

export async function POST(req: NextRequest) {
  // Parse + validate input
  let prompt: unknown;
  let repo: unknown;
  try {
    ({ prompt, repo } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json(
      { error: "Please provide a non-empty task." },
      { status: 400 }
    );
  }
  const task = prompt.trim();
  const repoStr = typeof repo === "string" ? repo.trim() : "";

  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  // Primary path: tool-using agent (Groq function calling). It searches the
  // repo, may read files, and can ask one clarifying question before planning.
  if (isUsableKey(groqKey)) {
    try {
      const outcome = await runAgent(task, repoStr, groqKey);
      if (outcome.type === "clarify") {
        return NextResponse.json({
          clarifyingQuestion: outcome.question,
          trace: outcome.trace,
        });
      }
      return NextResponse.json({ ...outcome.result, trace: outcome.trace });
    } catch (err) {
      console.error("[interngpt] agent failed, falling back:", err);
    }
  }

  // Fallback path: single-shot grounded generation (used when the agent errors
  // or no Groq key is set). Retrieve context directly for the prompt.
  let context = "No repository connected.";
  if (repoStr) {
    try {
      const matches = await retrieve(repoStr, task);
      context = renderContext(matches);
    } catch (err) {
      console.error("[interngpt] retrieval failed:", err);
      context = "Repository context unavailable (retrieval failed).";
    }
  }

  // Build the ordered attempt chain: Groq models first, then Gemini.
  const attempts: { label: string; run: () => Promise<string> }[] = [];
  if (isUsableKey(groqKey)) {
    for (const model of GROQ_MODELS) {
      attempts.push({
        label: `groq:${model}`,
        run: () => callGroq(model, PROMPT(task, context), groqKey),
      });
    }
  }
  if (isUsableKey(geminiKey)) {
    for (const model of GEMINI_MODELS) {
      attempts.push({
        label: `gemini:${model}`,
        run: () => callGemini(model, PROMPT(task, context), geminiKey),
      });
    }
  }

  if (attempts.length === 0) {
    return NextResponse.json(
      {
        error:
          "No API key configured. Add a free GROQ_API_KEY (https://console.groq.com/keys) " +
          "or GEMINI_API_KEY (https://aistudio.google.com/apikey) to frontend/.env.local.",
      },
      { status: 503 }
    );
  }

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      const raw = (await attempt.run()).trim();
      const parsed = parseResponse(raw);
      const autocompleted = (parsed.autocompleted_task ?? "").trim();
      const body: TaskResult = {
        autocompleted_task: autocompleted,
        reasoning: (parsed.reasoning ?? "").trim(),
        subtasks:
          Array.isArray(parsed.subtasks) && parsed.subtasks.length
            ? parsed.subtasks
            : breakIntoSubtasks(autocompleted),
      };
      return NextResponse.json(body);
    } catch (err) {
      lastError = err;
      console.error(`[interngpt] ${attempt.label} failed:`, err);
    }
  }

  // Every provider/model errored or exceeded quota
  console.error("[interngpt] all providers failed:", lastError);
  return NextResponse.json(
    { error: "All providers errored or exceeded quota. Try again shortly." },
    { status: 502 }
  );
}
