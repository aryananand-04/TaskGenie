import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-900 px-6 text-center">
      <h1 className="text-5xl font-bold mb-4 text-indigo-600">TaskGenie</h1>
      <p className="max-w-xl text-lg text-gray-600 mb-8">
        An AI-powered assistant that turns vague or incomplete task descriptions
        into clear, contextual, and actionable plans for interns and engineers.
      </p>
      <Link href="/dashboard">
        <Button className="text-base px-6 py-5">Open Dashboard</Button>
      </Link>
    </div>
  );
}
