// Heuristic fallback that splits a task into steps when the model does not
// supply its own subtasks. Shared by the API route and the agent.
// Port of agents/task_breakdown.py.
export function breakIntoSubtasks(detailedTask: string): string[] {
  if (!detailedTask?.trim()) return ["Break task into clear actionable steps."];
  const parts = detailedTask.split(/\n+|(?<=[.!?])\s+|;\s*|,\s+and\s+/);
  const steps = parts
    .map((p) => p.replace(/^[\s\-*\t]+|[\s\-*\t]+$/g, ""))
    .filter((p) => p.length > 3);
  return steps.length ? steps : ["Break task into clear actionable steps."];
}
