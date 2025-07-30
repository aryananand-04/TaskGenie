def autocomplete_task(task_input: str, context: str = "") -> dict:
    """
    Given a vague task input and optional context, return a dummy autocompleted version of the task.
    """
    # This will be replaced with actual LLM logic later
    return {
        "original_task": task_input,
        "autocompleted_task": "Fix the ElasticSearch query in search.py",
        "subtasks": [
            "Check logs in search.py",
            "Test for partial matches like 'prod', 'prod123'",
            "Validate ElasticSearch query syntax"
        ],
        "reasoning": "Based on past issues and logs, the bug usually lies in query formation."
    }