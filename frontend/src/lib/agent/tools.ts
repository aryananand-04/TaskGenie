// Tool definitions (OpenAI/Groq function-calling format) and executors for the
// non-terminal tools. The terminal tools (ask_clarifying_question, finalize_plan)
// are handled directly by the agent loop.

import { retrieve, renderContext } from "@/lib/rag/retrieve";
import { fetchFileContent, parseRepoRef } from "@/lib/rag/github";

export const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_code",
      description:
        "Semantic search over the connected repository. Returns the most relevant code chunks with their file paths and line numbers.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "What to look for, e.g. 'search query parsing'",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read the full contents of a file in the connected repository by its path.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Repo-relative file path, e.g. 'src/search.py'",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_clarifying_question",
      description:
        "Ask the user ONE clarifying question, but only when the task is too vague or ambiguous to ground confidently. Prefer searching the code first.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "A single, specific question" },
        },
        required: ["question"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "finalize_plan",
      description:
        "Produce the final clarified task. Call this once you have enough context.",
      parameters: {
        type: "object",
        properties: {
          autocompleted_task: {
            type: "string",
            description: "A clear, detailed version of the task",
          },
          reasoning: {
            type: "string",
            description: "Why you interpreted it this way; cite file paths used",
          },
          subtasks: {
            type: "array",
            items: { type: "string" },
            description: "Concrete, ordered steps",
          },
        },
        required: ["autocompleted_task", "reasoning", "subtasks"],
      },
    },
  },
] as const;

const MAX_TOOL_OUTPUT = 6000; // chars, to bound token usage

/** Execute a non-terminal tool and return text to feed back to the model. */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  repo: string
): Promise<string> {
  if (name === "search_code") {
    if (!repo) return "No repository is connected, so code search is unavailable.";
    const matches = await retrieve(repo, String(args.query ?? ""));
    return renderContext(matches).slice(0, MAX_TOOL_OUTPUT);
  }
  if (name === "read_file") {
    if (!repo) return "No repository is connected, so file reading is unavailable.";
    try {
      const content = await fetchFileContent(parseRepoRef(repo), String(args.path ?? ""));
      return content.slice(0, MAX_TOOL_OUTPUT);
    } catch (err) {
      return `Could not read ${String(args.path)}: ${
        err instanceof Error ? err.message : String(err)
      }`;
    }
  }
  return `Unknown tool: ${name}`;
}
