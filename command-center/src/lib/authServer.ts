import { supabaseServer } from "./supabaseServer";
import { supabaseAdmin } from "./supabase";
import { Profile, Role } from "./permissions";

export const authEnvConfigured = () =>
  !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** The logged-in user's profile (role, etc.), or null. Reads via service role to avoid RLS recursion. */
export async function callerProfile(): Promise<Profile | null> {
  if (!authEnvConfigured()) return null;
  try {
    const supabase = supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const admin = supabaseAdmin();
    if (!admin) return null;
    const { data } = await admin.from("profiles").select("*").eq("id", user.id).single();
    return (data as Profile) ?? null;
  } catch {
    return null;
  }
}

/** Guard for API routes. Returns {profile} when allowed, or {error,status} to return. */
export async function requireRole(roles: Role[]): Promise<{ profile: Profile } | { error: string; status: number }> {
  if (!authEnvConfigured()) {
    // auth not configured yet (env vars missing) — fail open so the app isn't bricked mid-setup
    return { profile: { role: "Owner" } as Profile };
  }
  const profile = await callerProfile();
  if (!profile) return { error: "Unauthorized", status: 401 };
  if (!profile.active) return { error: "Account disabled", status: 403 };
  if (!roles.includes(profile.role)) return { error: "Forbidden", status: 403 };
  return { profile };
}
