// Lightweight, free, zero-dependency task history stored in the browser's
// localStorage. No database, no account — persists per-browser only.

export type TaskResult = {
  autocompleted_task: string;
  reasoning: string;
  subtasks: string[];
};

export type HistoryEntry = {
  id: string;
  input: string;
  result: TaskResult;
  createdAt: number; // epoch ms
};

const STORAGE_KEY = "taskgenie_history";
const MAX_ENTRIES = 100;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function getHistory(): HistoryEntry[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function addHistoryEntry(input: string, result: TaskResult): HistoryEntry {
  const entry: HistoryEntry = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    input,
    result,
    createdAt: Date.now(),
  };
  if (!canUseStorage()) return entry;
  // Newest first, capped so storage can't grow unbounded.
  const next = [entry, ...getHistory()].slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota exceeded or storage disabled — fail silently; result still shows.
  }
  return entry;
}

export function clearHistory(): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
