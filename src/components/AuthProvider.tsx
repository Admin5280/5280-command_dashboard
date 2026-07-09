"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Profile, Role, Capability, can as roleCan, canAccessPage, landingPage } from "@/lib/permissions";
import { supabaseBrowser, authConfigured } from "@/lib/supabaseBrowser";
import { useStore } from "@/lib/store";

interface AuthState {
  loading: boolean;
  configured: boolean;   // is Supabase Auth set up (env vars present)?
  profile: Profile | null;
  role: Role | undefined;
  can: (cap: Capability) => boolean;
  canAccess: (path: string) => boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const store = useStore();
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me").then((r) => r.json()).then((j) => {
      if (cancelled) return;
      setConfigured(!!j.configured);
      setProfile(j.profile ?? null);
      // sales reps / technicians default their dashboards to themselves
      if (j.profile?.name && (j.profile.role === "Sales Rep" || j.profile.role === "Technician")) {
        store.setCurrentRep(j.profile.name);
      }
    }).catch(() => setConfigured(false)).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const role = profile?.role;
  const landing = landingPage(role);

  // the root "/" routes each role to their own dashboard (so no one lands on a page they can't open)
  useEffect(() => {
    if (configured && !loading && profile && profile.active && pathname === "/" && !canAccessPage(role, "/")) {
      router.replace(landing);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, loading, profile, pathname, role]);

  const value: AuthState = {
    loading, configured, profile, role,
    can: (cap) => (configured ? roleCan(role, cap) : true),
    canAccess: (path) => (configured ? canAccessPage(role, path) : true),
    signOut: async () => {
      if (authConfigured()) { try { await supabaseBrowser().auth.signOut(); } catch { /* ignore */ } }
      window.location.href = "/login";
    },
  };

  // login page renders without the auth gate
  if (pathname === "/login") return <Ctx.Provider value={value}>{children}</Ctx.Provider>;

  // while resolving the session (auth configured), hold rendering to avoid flashing restricted pages
  if (configured && loading) {
    return <Ctx.Provider value={value}><div className="min-h-screen flex items-center justify-center bg-base text-muted text-sm">Loading…</div></Ctx.Provider>;
  }

  // account disabled
  if (configured && !loading && profile && !profile.active) {
    return <Gate title="Account disabled" body="Your access has been turned off. Contact an Owner or Admin." onSignOut={value.signOut} />;
  }
  // page-level role gate
  if (configured && !loading && profile && !canAccessPage(role, pathname)) {
    // root routes by role (redirect in flight) — show a brief loader instead of "No access"
    if (pathname === "/") {
      return <Ctx.Provider value={value}><div className="min-h-screen flex items-center justify-center bg-base text-muted text-sm">Loading…</div></Ctx.Provider>;
    }
    return (
      <Gate title="No access" body={`Your role (${role}) can't open this page.`} onSignOut={value.signOut}
        onDashboard={() => router.replace(landing)} />
    );
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function Gate({ title, body, onSignOut, onDashboard }: { title: string; body: string; onSignOut: () => void; onDashboard?: () => void }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-3 p-8">
      <div className="text-lg font-semibold text-ink">{title}</div>
      <div className="text-sm text-muted max-w-sm">{body}</div>
      <div className="flex items-center gap-2 mt-2">
        {onDashboard && <button onClick={onDashboard} className="px-3 py-1.5 rounded-lg text-sm bg-accent text-white hover:bg-accent2">Go to My Dashboard</button>}
        <button onClick={onSignOut} className="px-3 py-1.5 rounded-lg text-sm bg-surface2 border border-line text-ink hover:border-muted">Sign out</button>
      </div>
    </div>
  );
}

export function useAuth(): AuthState {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside <AuthProvider>");
  return c;
}
