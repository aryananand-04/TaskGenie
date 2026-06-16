"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getHistory, clearHistory } from "@/lib/history";

export default function SettingsPage() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    setCount(getHistory().length);
  }, []);

  const handleClear = () => {
    clearHistory();
    setCount(0);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-4xl font-semibold mb-6">Settings</h1>

      <section className="bg-white p-6 rounded-lg shadow border mb-6">
        <h2 className="font-semibold text-gray-900 mb-2">AI providers</h2>
        <p className="text-gray-600 text-sm mb-3">
          Requests try <strong>Groq</strong> first, then fall back to{" "}
          <strong>Gemini</strong>. Keys are read from server environment
          variables and are never exposed to the browser.
        </p>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>
            Groq (primary) — free key at{" "}
            <a
              className="text-indigo-600 hover:underline"
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
            >
              console.groq.com/keys
            </a>{" "}
            → set <code>GROQ_API_KEY</code>
          </li>
          <li>
            Gemini (fallback) — free key at{" "}
            <a
              className="text-indigo-600 hover:underline"
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
            >
              aistudio.google.com/apikey
            </a>{" "}
            → set <code>GEMINI_API_KEY</code>
          </li>
        </ul>
        <p className="text-gray-500 text-xs mt-3">
          Add either or both to <code>frontend/.env.local</code>, then restart
          the dev server.
        </p>
      </section>

      <section className="bg-white p-6 rounded-lg shadow border">
        <h2 className="font-semibold text-gray-900 mb-2">Task history</h2>
        <p className="text-gray-600 text-sm mb-4">
          History is stored locally in this browser only (no account, no server).
          {count !== null && (
            <>
              {" "}
              You currently have <strong>{count}</strong> saved task
              {count === 1 ? "" : "s"}.
            </>
          )}
        </p>
        <Button
          variant="destructive"
          onClick={handleClear}
          disabled={count === 0}
        >
          Clear all history
        </Button>
      </section>
    </div>
  );
}
