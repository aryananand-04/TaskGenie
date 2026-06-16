"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  getHistory,
  clearHistory,
  type HistoryEntry,
} from "@/lib/history";

export default function TasksPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setEntries(getHistory());
    setLoaded(true);
  }, []);

  const handleClear = () => {
    clearHistory();
    setEntries([]);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-4xl font-semibold">Task history</h1>
        {entries.length > 0 && (
          <Button variant="outline" onClick={handleClear}>
            Clear history
          </Button>
        )}
      </div>

      {!loaded ? null : entries.length === 0 ? (
        <div className="bg-white p-8 rounded-lg shadow border text-center">
          <p className="text-gray-600 mb-4">
            No tasks yet. Autocompleted tasks you generate will appear here.
          </p>
          <Link href="/dashboard">
            <Button>Go to dashboard</Button>
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="bg-white p-5 rounded-lg shadow border space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm text-gray-500 italic">“{entry.input}”</p>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900">
                  {entry.result.autocompleted_task}
                </h3>
                {entry.result.reasoning && (
                  <p className="text-gray-600 text-sm mt-1">
                    {entry.result.reasoning}
                  </p>
                )}
              </div>

              {entry.result.subtasks?.length > 0 && (
                <ol className="list-decimal list-inside text-gray-700 text-sm space-y-1">
                  {entry.result.subtasks.map((sub, i) => (
                    <li key={i}>{sub}</li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
