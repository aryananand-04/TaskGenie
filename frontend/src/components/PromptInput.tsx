"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function PromptInput() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState("");

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setResponse("");

    try {
      const res = await fetch("/api/interngpt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input }),
      });

      const data = await res.json();
      setResponse(data.result || "No response");
    } catch (err) {
      setResponse("Error contacting InternGPT.");
    }

    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Enter your prompt..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? "Thinking..." : "Submit"}
        </Button>
      </div>
      {response && (
        <div className="bg-white p-4 rounded-lg shadow border text-gray-700">
          <strong>Response:</strong>
          <p>{response}</p>
        </div>
      )}
    </div>
  );
}
