from agents.task_autocomplete import autocomplete_task
from context.context_collector import collect_context
from output.output_renderer import render_output

def main():
    # Step 1: Simulate input
    user_task = "Fix the search bug"

    # Step 2: Get dummy context
    context = collect_context()

    # Step 3: Autocomplete the task
    result = autocomplete_task(user_task, context)

    # Step 4: Render the output
    render_output(result)

if __name__ == "__main__":
    main()