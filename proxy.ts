import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig, type CookieToSet } from "./lib/supabase/config";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Protección CSRF: todo lo que modifica datos debe venir de este mismo sitio.
function isSameOrigin(request: NextRequest) {
  const source = request.headers.get("origin") ?? request.headers.get("referer");
  if (!source) return false;
  try {
    return new URL(source).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

function redirectKeepingCookies(url: URL, from: NextResponse) {
  const res = NextResponse.redirect(url);
  from.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}

export async function proxy(request: NextRequest) {
  if (!SAFE_METHODS.has(request.method) && !isSameOrigin(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }

  const { pathname } = request.nextUrl;
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const cfg = getSupabaseConfig();
  if (!isAdminArea || !cfg) return NextResponse.next();

  // Refresca la sesión y hace una comprobación rápida. La verificación real
  // (correo autorizado + RLS) se repite en cada página y acción del panel.
  let response = NextResponse.next({ request });
  const supabase = createServerClient(cfg.url, cfg.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list: CookieToSet[]) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();

  const isPublicAdmin = pathname === "/admin/login" || pathname === "/admin/acceso";
  if (!user && !isPublicAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return redirectKeepingCookies(url, response);
  }
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|webmanifest)$).*)"],
};
