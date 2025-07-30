def render_output(task_data: dict):
    """
    Renders the autocompleted task output nicely to the terminal.
    """
    print("\n🔧 Original Task:")
    print(f"  {task_data['original_task']}")

    print("\n✅ Autocompleted Task:")
    print(f"  {task_data['autocompleted_task']}")

    print("\n🧩 Subtasks:")
    for idx, subtask in enumerate(task_data['subtasks'], 1):
        print(f"  {idx}. {subtask}")

    print("\n💡 Reasoning:")
    print(f"  {task_data['reasoning']}")