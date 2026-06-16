// Tool-using agent loop over Groq's OpenAI-compatible function calling.
// The model can search the repo, read files, ask one clarifying question, or
// finalize a grounded plan. Bounded by MAX_STEPS to cap cost/latency.

import { TOOLS, runTool } from "./tools";
import { breakIntoSubtasks } from "@/lib/subtasks";

const MODEL = "llama-3.3-70b-versatile";
const MAX_STEPS = 6;

export type TaskResult = {
  autocompleted_task: string;
  reasoning: string;
  subtasks: string[];
};

export type AgentOutcome =
  | { type: "result"; result: TaskResult; trace: string[] }
  | { type: "clarify"; question: string; trace: string[] };

const SYSTEM = `You are TaskGenie, an agent that turns a vague software task into a concrete, code-grounded plan for an intern.
Work in steps: use search_code (and read_file when helpful) to ground yourself in the actual repository before planning.
Cite real file paths and line numbers in your reasoning. Only use ask_clarifying_question if the task is genuinely too ambiguous to ground. When ready, call finalize_plan.`;

// Loose chat message type — Groq returns assistant messages with tool_calls.
type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

async function groqChat(
  messages: ChatMessage[],
  apiKey: string
): Promise<ChatMessage> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.3,
    }),
  });
  if (!res.ok) {
    throw new Error(`Groq agent HTTP ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.choices[0].message as ChatMessage;
}

function safeArgs(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json || "{}");
  } catch {
    return {};
  }
}

function normalizeResult(args: Record<string, unknown>): TaskResult {
  const autocompleted = String(args.autocompleted_task ?? "").trim();
  const subtasks = Array.isArray(args.subtasks)
    ? (args.subtasks as unknown[]).map(String)
    : [];
  return {
    autocompleted_task: autocompleted,
    reasoning: String(args.reasoning ?? "").trim(),
    subtasks: subtasks.length ? subtasks : breakIntoSubtasks(autocompleted),
  };
}

export async function runAgent(
  task: string,
  repo: string,
  apiKey: string
): Promise<AgentOutcome> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: repo
        ? `Repository connected: ${repo}\n\nVague task: ${task}`
        : `No repository connected.\n\nVague task: ${task}`,
    },
  ];
  const trace: string[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const msg = await groqChat(messages, apiKey);
    messages.push(msg);

    const calls = msg.tool_calls ?? [];

    // No tool call → treat the content as the final clarified task.
    if (calls.length === 0) {
      const content = (msg.content ?? "").trim();
      return {
        type: "result",
        result: normalizeResult({
          autocompleted_task: content,
          reasoning: "",
          subtasks: [],
        }),
        trace,
      };
    }

    // Terminal tools win immediately.
    for (const call of calls) {
      const args = safeArgs(call.function.arguments);
      if (call.function.name === "finalize_plan") {
        trace.push("finalize_plan");
        return { type: "result", result: normalizeResult(args), trace };
      }
      if (call.function.name === "ask_clarifying_question") {
        trace.push("ask_clarifying_question");
        return {
          type: "clarify",
          question: String(args.question ?? "Could you clarify the task?"),
          trace,
        };
      }
    }

    // Otherwise execute every (non-terminal) tool call and feed results back.
    for (const call of calls) {
      const args = safeArgs(call.function.arguments);
      const out = await runTool(call.function.name, args, repo);
      trace.push(`${call.function.name}(${JSON.stringify(args)})`);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: out,
      });
    }
  }

  // Out of steps — force a final plan from what we have.
  messages.push({
    role: "user",
    content: "Stop searching and call finalize_plan now with your best plan.",
  });
  const final = await groqChat(messages, apiKey);
  const finalize = (final.tool_calls ?? []).find(
    (c) => c.function.name === "finalize_plan"
  );
  if (finalize) {
    trace.push("finalize_plan (forced)");
    return { type: "result", result: normalizeResult(safeArgs(finalize.function.arguments)), trace };
  }
  return {
    type: "result",
    result: normalizeResult({
      autocompleted_task: (final.content ?? task).trim(),
      reasoning: "",
      subtasks: [],
    }),
    trace,
  };
}
