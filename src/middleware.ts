import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Public paths (no login required). The GHL webhook is excluded here AND in the
// matcher below so it is never touched by auth — it uses its own secret header.
function isPublic(path: string): boolean {
  return path.startsWith("/login") || path.startsWith("/api/webhooks");
}

export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Fail-open if auth isn't configured yet (avoids locking everyone out before env vars are set).
  if (!url || !key) return NextResponse.next();

  const path = req.nextUrl.pathname;
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();

  if (isPublic(path)) {
    if (user && path.startsWith("/login")) return NextResponse.redirect(new URL("/", req.url));
    return res;
  }

  if (!user) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const login = new URL("/login", req.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  return res;
}

export const config = {
  // Run on everything except static assets and the public webhook.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|Logo.svg|api/webhooks).*)"],
};
