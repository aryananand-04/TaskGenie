import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

# Configure Gemini API
genai.configure(api_key=api_key)

# Gemini model list for fallback
MODELS = [
    "models/gemini-1.5-pro",
    "models/gemini-1.5-flash",
    "models/gemini-1.5-flash-latest",
    "models/gemini-1.5-flash-002"
]

def autocomplete_task(task_input, context):
    prompt = f"""You are an AI assistant helping an intern clarify vague software development tasks.

Vague Task: {task_input}
Context: {context if context else 'No additional context.'}

Respond with a detailed, clear version of this task that an intern can understand and execute.
"""

    for model_name in MODELS:
        try:
            print(f"[+] Trying model: {model_name}")
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            final_result = response.text.strip()

            return {
                "autocompleted_task": final_result
            }

        except Exception as e:
            print(f"[!] Model {model_name} failed:\n  {e}\n")

    # Fallback output if all models fail
    return {
        "autocompleted_task": "❌ Failed to generate task: All Gemini models exceeded quota or encountered errors."
    }
