# feedback/feedback_loop.py

import json
import os


def save_completed_task(
    task_input: str,
    completed_task: dict,
    data_path: str = "data/sample_tasks.json",
) -> None:
    """
    Closes the loop: append the autocompleted task back into the task history so
    future runs can surface it as context. Stored description combines the
    original vague input with the clarified version for better keyword matching.
    """
    autocompleted = completed_task.get("autocompleted_task", "").strip()
    if not autocompleted:
        return

    tasks = []
    if os.path.exists(data_path):
        with open(data_path, "r") as f:
            try:
                tasks = json.load(f)
            except json.JSONDecodeError:
                tasks = []

    description = f"{task_input} — {autocompleted}"
    if any(t.get("description") == description for t in tasks):
        return

    tasks.append({"description": description})

    os.makedirs(os.path.dirname(data_path), exist_ok=True)
    with open(data_path, "w") as f:
        json.dump(tasks, f, indent=2)
