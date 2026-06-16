// LLM-as-judge. Uses Gemini (via REST) to score a clarified task on three axes.
// A different provider than generation (Groq) judges, to reduce self-preference.

const JUDGE_MODEL = "gemini-2.0-flash";

const RUBRIC = `You are grading how well an AI clarified a vague software task.

Score each axis from 1 (poor) to 5 (excellent):
- groundedness: references SPECIFIC files, functions, or identifiers from a real codebase rather than generic advice.
- clarity: the rewritten task is unambiguous and well-scoped.
- actionability: the subtasks are concrete steps an intern could execute.

Respond ONLY with JSON: {"groundedness": n, "clarity": n, "actionability": n, "comment": "<one line>"}`;

export async function judge(apiKey, vagueTask, output, notes) {
  const prompt = `${RUBRIC}

Original vague task: ${vagueTask}
What a good answer should include: ${notes}

AI output to grade:
${output}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${JUDGE_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // temperature 0 → deterministic, reproducible scores across runs.
        generationConfig: { temperature: 0 },
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Judge HTTP ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Judge returned no JSON: ${text.slice(0, 200)}`);
  const scores = JSON.parse(match[0]);
  return {
    groundedness: Number(scores.groundedness) || 0,
    clarity: Number(scores.clarity) || 0,
    actionability: Number(scores.actionability) || 0,
    comment: String(scores.comment ?? ""),
  };
}
