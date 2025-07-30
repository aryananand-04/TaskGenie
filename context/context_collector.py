# context/context_collector.py

import json
import os

def load_context(task_input: str, data_path: str = "data/sample_tasks.json") -> str:
    """
    Loads context by finding tasks similar to the input in past records.
    Currently does simple substring matching on task descriptions.
    """
    if not os.path.exists(data_path):
        return "No historical context found."

    with open(data_path, "r") as f:
        past_tasks = json.load(f)

    similar_contexts = []
    for task in past_tasks:
        if task_input.lower() in task["description"].lower():
            similar_contexts.append(task["description"])

    if not similar_contexts:
        return "No matching context found in past tasks."

    return "Related tasks:\n" + "\n".join(f"- {ctx}" for ctx in similar_contexts)