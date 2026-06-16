# agents/task_breakdown.py

import re


def break_into_subtasks(detailed_task: str) -> list:
    """
    Heuristic fallback that splits a task into actionable steps when the LLM
    does not supply its own subtasks. Splits on sentences and bullet markers.
    """
    if not detailed_task or not detailed_task.strip():
        return ["Break task into clear actionable steps."]

    parts = re.split(r"(?:\n+|(?<=[.!?])\s+|;\s*|,\s+and\s+)", detailed_task)
    steps = [p.strip(" -*\t") for p in parts if len(p.strip(" -*\t")) > 3]

    return steps or ["Break task into clear actionable steps."]
