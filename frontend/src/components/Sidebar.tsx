"use client";

import { Home, ListChecks, Users, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const links = [
  { href: "/dashboard", label: "Overview", icon: Home },
  { href: "/dashboard/tasks", label: "Tasks", icon: ListChecks },
  { href: "/dashboard/team", label: "Team", icon: Users },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-indigo-600 text-white p-6 space-y-6">
      <h2 className="text-2xl font-bold">TaskGenie</h2>
      <nav className="space-y-2">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 px-3 py-2 rounded hover:bg-indigo-500",
              pathname === href && "bg-indigo-500"
            )}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
