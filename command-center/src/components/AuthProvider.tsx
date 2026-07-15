"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Profile, Role, Capability, can as roleCan, canAccessPage, landingPage } from "@/lib/permissions";
import { supabaseBrowser, authConfigured } from "@/lib/supabaseBrowser";
import { useStore } from "@/lib/store";
import { Button, Field, Input, Modal } from "@/components/ui";

interface AuthState {
  loading: boolean;
  configured: boolean;   // is Supabase Auth set up (env vars present)?
  profile: Profile | null;
  role: Role | undefined;
  can: (cap: Capability) => boolean;
  canAccess: (path: string) => boolean;
  signOut: () => Promise<void>;
  openChangePassword: () => void;
  openProfile: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const store = useStore();
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

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
    openChangePassword: () => setPwdOpen(true),
    openProfile: () => setProfileOpen(true),
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

  return (
    <Ctx.Provider value={value}>
      {children}
      <ChangePasswordModal open={pwdOpen} onClose={() => setPwdOpen(false)} />
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} profile={profile} />
    </Ctx.Provider>
  );
}

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setMsg(null);
    if (pw.length < 8) { setMsg({ ok: false, text: "Password must be at least 8 characters." }); return; }
    if (pw !== confirm) { setMsg({ ok: false, text: "Passwords do not match." }); return; }
    setBusy(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: "✓ Password updated." }); setPw(""); setConfirm("");
  }
  return (
    <Modal open={open} onClose={onClose} title="Change Password">
      <div className="space-y-3 max-w-sm">
        <Field label="New Password"><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Field label="Confirm New Password"><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        {msg && <div className={`text-sm px-3 py-2 rounded-lg border ${msg.ok ? "text-good border-good/30 bg-good/10" : "text-danger border-danger/30 bg-danger/10"}`}>{msg.text}</div>}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Close</Button>
          <Button variant="accent" onClick={() => { if (!busy) save(); }}>{busy ? "Saving…" : "Update Password"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function ProfileModal({ open, onClose, profile }: { open: boolean; onClose: () => void; profile: Profile | null }) {
  return (
    <Modal open={open} onClose={onClose} title="My Profile">
      {profile ? (
        <div className="space-y-2 text-sm max-w-sm">
          {([["Name", profile.name], ["Email", profile.email], ["Phone", profile.phone], ["Role", profile.role], ["Department", profile.department]] as const).map(([l, v]) => (
            <div key={l} className="flex justify-between border-b border-line/60 py-1.5"><span className="text-muted">{l}</span><span className="text-ink">{v || "—"}</span></div>
          ))}
          <p className="text-xs text-muted pt-2">To change your name, phone, or role, ask an Owner or Admin. You can change your own password anytime.</p>
        </div>
      ) : <div className="text-sm text-muted">Not signed in.</div>}
    </Modal>
  );
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
