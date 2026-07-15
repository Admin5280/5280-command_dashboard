import { NextResponse } from "next/server";
import { callerProfile, authEnvConfigured } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/me → the logged-in user's profile (role, name, etc.)
export async function GET() {
  if (!authEnvConfigured()) {
    // auth not set up yet — report unconfigured so the client can run open
    return NextResponse.json({ configured: false, profile: null });
  }
  const profile = await callerProfile();
  if (!profile) return NextResponse.json({ configured: true, profile: null }, { status: 401 });
  return NextResponse.json({ configured: true, profile });
}
