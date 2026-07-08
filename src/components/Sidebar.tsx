"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

export const NAV = [
  { href: "/", label: "Overview", icon: "▤" },
  { href: "/care-club", label: "Care Club", icon: "✦" },
  { href: "/leads", label: "Leads", icon: "◎" },
  { href: "/jobs", label: "Jobs", icon: "◧" },
  { href: "/marketing", label: "Marketing", icon: "◈" },
  { href: "/sales", label: "Sales", icon: "◭" },
  { href: "/operations", label: "Operations", icon: "⛭" },
  { href: "/quality", label: "Quality", icon: "★" },
  { href: "/payroll", label: "Payroll", icon: "◱" },
  { href: "/finance", label: "Finance", icon: "$" },
  { href: "/audit", label: "Audit", icon: "❑" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const { profile, role, configured, canAccess, signOut } = useAuth();
  const nav = NAV.filter((n) => canAccess(n.href));

  return (
    <aside className="w-60 shrink-0 bg-surface border-r border-line min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-line">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Logo.svg" alt="5280" className="h-10 w-auto" />
          <div>
            <div className="text-sm font-bold text-ink leading-tight">COMMAND CENTER</div>
            <div className="text-[10px] text-muted">Mobile Detailing · Auto Studio</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto">
        {nav.map((n) => {
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

      <div className="border-t border-line px-4 py-3">
        {configured && profile ? (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-medium text-ink truncate">{profile.name || profile.email}</div>
              <div className="text-[10px] text-muted">{role}</div>
            </div>
            <button onClick={signOut} className="text-[11px] text-muted hover:text-danger border border-line rounded-lg px-2 py-1 shrink-0">Sign out</button>
          </div>
        ) : (
          <div className="text-[10px] text-muted">MVP · local data</div>
        )}
      </div>
    </aside>
  );
}
