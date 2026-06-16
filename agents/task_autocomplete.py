import json
import os
import re
import urllib.error
import urllib.request

import google.generativeai as genai
from dotenv import load_dotenv

from agents.task_breakdown import break_into_subtasks

# Load environment variables
load_dotenv()

PLACEHOLDER = "your_key_here"
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Provider chain: Groq (primary) -> Gemini (fallback). Within each provider we
# also fall through a list of models if one is unavailable or rate-limited.
GROQ_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
GEMINI_MODELS = [
    "models/gemini-2.0-flash",
    "models/gemini-2.0-flash-lite",
    "models/gemini-1.5-flash",
]


def _usable(key: str | None) -> bool:
    """A key is usable if it is set and not the .env.example placeholder."""
    return bool(key) and key != PLACEHOLDER


# Configure Gemini only when we actually have a real key.
if _usable(GEMINI_API_KEY):
    genai.configure(api_key=GEMINI_API_KEY)

PROMPT_TEMPLATE = """You are an AI assistant helping an intern clarify vague software development tasks.

Vague Task: {task_input}
Context: {context}

Rewrite this as a detailed, actionable task an intern can execute, and break it
into concrete subtasks.

Respond ONLY with valid JSON in exactly this shape:
{{
  "autocompleted_task": "<a clear, detailed version of the task>",
  "reasoning": "<why you interpreted it this way>",
  "subtasks": ["<step 1>", "<step 2>", "..."]
}}
"""


def _parse_response(text: str) -> dict:
    """Extract the JSON object from the model response, tolerating code fences."""
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError("No JSON object found in model response.")


def _call_groq(model_name: str, prompt: str) -> str:
    """Call Groq's OpenAI-compatible chat endpoint (stdlib only). Returns text."""
    body = json.dumps(
        {
            "model": model_name,
            "messages": [{"role": "user", "content": prompt}],
            # The word "JSON" appears in the prompt, satisfying json_object mode.
            "response_format": {"type": "json_object"},
            "temperature": 0.4,
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        data = json.loads(response.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]


def _call_gemini(model_name: str, prompt: str) -> str:
    """Call Gemini via the official SDK. Returns raw model text."""
    model = genai.GenerativeModel(model_name)
    response = model.generate_content(prompt)
    return response.text


def autocomplete_task(task_input, context):
    prompt = PROMPT_TEMPLATE.format(
        task_input=task_input,
        context=context if context else "No additional context.",
    )

    # Build the ordered attempt chain: Groq models first, then Gemini.
    attempts = []
    if _usable(GROQ_API_KEY):
        for model_name in GROQ_MODELS:
            attempts.append(
                (f"groq:{model_name}", lambda m=model_name: _call_groq(m, prompt))
            )
    if _usable(GEMINI_API_KEY):
        for model_name in GEMINI_MODELS:
            attempts.append(
                (f"gemini:{model_name}", lambda m=model_name: _call_gemini(m, prompt))
            )

    if not attempts:
        return {
            "autocompleted_task": (
                "No API key configured. Set GROQ_API_KEY "
                "(https://console.groq.com/keys) or GEMINI_API_KEY "
                "(https://aistudio.google.com/apikey) in your .env file."
            ),
            "reasoning": "N/A",
            "subtasks": break_into_subtasks(task_input),
        }

    for label, run in attempts:
        try:
            print(f"[+] Trying {label}")
            text = run().strip()
            parsed = _parse_response(text)

            return {
                "autocompleted_task": parsed.get("autocompleted_task", "").strip(),
                "reasoning": parsed.get("reasoning", "").strip(),
                "subtasks": parsed.get("subtasks")
                or break_into_subtasks(parsed.get("autocompleted_task", "")),
            }
        except Exception as e:
            print(f"[!] {label} failed:\n  {e}\n")

    # Fallback output if every provider/model fails
    return {
        "autocompleted_task": "Failed to generate task: all providers errored or exceeded quota.",
        "reasoning": "N/A",
        "subtasks": break_into_subtasks(task_input),
    }
