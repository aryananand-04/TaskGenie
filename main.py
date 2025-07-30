from context.context_collector import collect_context
from agents.task_autocomplete import autocomplete_task
from output.output_renderer import render_output

def main():
    print("🔍 Welcome to Intern Task Autocomplete Agent!")

    # Step 1: Input a vague task
    task_input = input("\nEnter your vague task: ").strip()

    # Step 2: Collect context (simulated)
    context = collect_context(task_input)

    # Step 3: Autocomplete task using agent (dummy for now)
    completed_task = autocomplete_task(task_input, context)

    # Step 4: Add context used to the response
    completed_task["context_used"] = context

    # Step 5: Display final output
    render_output(completed_task)

if __name__ == "__main__":
    main()
