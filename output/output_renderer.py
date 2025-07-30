# output/output_renderer.py

def render_output(task_info: dict) -> None:
    print("\n📌 Autocompleted Task:")
    print(f"→ {task_info['autocompleted_task']}\n")

    print("🧠 Reasoning:")
    print(f"{task_info.get('reasoning', 'N/A')}\n")

    print("📋 Subtasks:")
    for i, sub in enumerate(task_info.get("subtasks", []), start=1):
        print(f"{i}. {sub}")

    print("\n🧾 Context Used:")
    print(task_info.get("context_used", "No context provided."))
