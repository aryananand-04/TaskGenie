// src/app/dashboard/layout.tsx

import "@/app/globals.css";
import { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-gray-50 text-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-indigo-600 text-white shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-8">TaskGenie</h2>
        <nav className="space-y-4">
          <a href="#" className="block hover:bg-indigo-500 rounded px-3 py-2">Overview</a>
          <a href="#" className="block hover:bg-indigo-500 rounded px-3 py-2">Tasks</a>
          <a href="#" className="block hover:bg-indigo-500 rounded px-3 py-2">Settings</a>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-10 space-y-6">{children}</main>
    </div>
  );
}
