# context/context_collector.py

import json
import os

from utils.helpers import extract_keywords


def load_context(task_input: str, data_path: str = "data/sample_tasks.json") -> str:
    """
    Loads context by finding tasks similar to the input in past records.
    Uses keyword overlap so a vague input still surfaces related past tasks.
    """
    if not os.path.exists(data_path):
        return "No historical context found."

    with open(data_path, "r") as f:
        past_tasks = json.load(f)

    input_keywords = extract_keywords(task_input)
    if not input_keywords:
        return "No matching context found in past tasks."

    scored = []
    for task in past_tasks:
        description = task.get("description", "")
        overlap = input_keywords & extract_keywords(description)
        if overlap:
            scored.append((len(overlap), description))

    if not scored:
        return "No matching context found in past tasks."

    scored.sort(reverse=True)
    top = [desc for _, desc in scored[:5]]
    return "Related tasks:\n" + "\n".join(f"- {desc}" for desc in top)
