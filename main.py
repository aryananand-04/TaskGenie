from context.context_collector import load_context
from agents.task_autocomplete import autocomplete_task
from output.output_renderer import render_output

def main():
    print("🔍 Welcome to Intern Task Autocomplete Agent!")

    # Step 1: Input a vague task
    task_input = input("\nEnter your vague task: ").strip()
    if not task_input:
        print("❌ No task entered. Please provide a valid input.")
        return

    # Step 2: Load relevant context from past tasks
    context = load_context(task_input)

    # Step 3: Generate detailed task using the autocomplete agent
    try:
        completed_task = autocomplete_task(task_input, context)
    except Exception as e:
        print("\n❌ Error while autocompleting task:")
        print(e)
        return

    # Step 4: Add the used context to the task response
    completed_task["context_used"] = context

    # Step 5: Render and print the output
    render_output(completed_task)

if __name__ == "__main__":
    main()
