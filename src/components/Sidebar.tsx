"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV = [
  { href: "/", label: "Overview", icon: "▤" },
  { href: "/care-club", label: "Care Club", icon: "✦" },
  { href: "/leads", label: "Leads", icon: "◎" },
  { href: "/jobs", label: "Jobs", icon: "◧" },
  { href: "/marketing", label: "Marketing", icon: "◈" },
  { href: "/sales", label: "Sales", icon: "◭" },
  { href: "/operations", label: "Operations", icon: "⛭" },
  { href: "/payroll", label: "Payroll", icon: "◱" },
  { href: "/finance", label: "Finance", icon: "$" },
  { href: "/audit", label: "Audit", icon: "❑" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <aside className="w-60 shrink-0 bg-surface border-r border-line min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-line">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white font-black text-sm">52</span>
          <div>
            <div className="text-sm font-bold text-ink leading-tight">COMMAND CENTER</div>
            <div className="text-[10px] text-muted">Mobile Detailing · Auto Studio</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 py-3">
        {NAV.map((n) => {
          const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} onClick={onNavigate}
              className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors border-l-2 ${
                active ? "border-accent bg-accent/10 text-ink font-medium" : "border-transparent text-muted hover:text-ink hover:bg-surface2/50"
              }`}>
              <span className="w-4 text-center text-accent2">{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-3 text-[10px] text-muted border-t border-line">MVP · local data</div>
    </aside>
  );
}
