# agents/task_breakdown.py

def break_into_subtasks(detailed_task: str) -> list:
    """
    Dummy logic to break a detailed task into subtasks.
    Replace this with LLM logic later.
    """
    if "search" in detailed_task.lower():
        return [
            "Investigate search.py for bugs",
            "Test ElasticSearch queries",
            "Write unit tests for edge cases"
        ]
    return ["Break task into clear actionable steps."]