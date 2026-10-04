import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { readDeviceCookie, verifyDeviceToken } from "@/lib/device-token";

// Session attach + app gates. Public paths: auth pages, API auth,
// static assets. /dashboard, /kds, /pos, /kot, /dispatch and /rider require a
// Better Auth session (all show live order and payment data — never
// anonymous). /kiosk stays public by design (customer self-ordering).
//
// Offline grace: when the session lookup THROWS (IdP/DB unreachable), a
// valid pixa_device cookie (paired while online) keeps the app open instead
// of bouncing to sign-in. An online-but-anonymous request still redirects —
// the device cookie is never a bypass, only a fallback.
const PUBLIC_PREFIXES = ["/auth/", "/api/auth/"];

/**
 * Subdomain → surface mapping (multi-subdomain architecture:
 * kds/kiosk/kot/order/captain all serve the web app with `/` rewritten to
 * their surface; www/admin are separate Vercel projects). Localhost and the
 * apex/app domains keep default routing.
 */
const SURFACE_HOSTS: Record<string, string> = {
  "kds.pixapos.store": "/kds",
  "kiosk.pixapos.store": "/kiosk",
  "kot.pixapos.store": "/kot",
  "order.pixapos.store": "/qr",
  "captain.pixapos.store": "/pos",
};

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0] ?? "";
  const surface = SURFACE_HOSTS[host];
  let { pathname } = request.nextUrl;
  // Only the bare surface root rewrites — deep links, assets and API
  // keep working untouched on every subdomain.
  const rewritten = surface && pathname === "/" ? surface : null;
  if (rewritten) pathname = rewritten;
  // Pass-through that honors a pending surface rewrite.
  const pass = () => {
    if (!rewritten) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = rewritten;
    return NextResponse.rewrite(url);
  };
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return pass();
  }
  if (
    !pathname.startsWith("/dashboard") &&
    pathname !== "/kds" &&
    pathname !== "/pos" &&
    pathname !== "/kot" &&
    pathname !== "/dispatch" &&
    !pathname.startsWith("/dispatch/") &&
    pathname !== "/rider" &&
    pathname !== "/onboarding"
  ) {
    return pass();
  }
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/sign-in";
      return NextResponse.redirect(url);
    }
    return pass();
  } catch {
    // Session store unreachable (offline): honor a paired device session.
    const raw = readDeviceCookie(request.headers.get("cookie"));
    if (raw) {
      const claims = await verifyDeviceToken(raw);
      if (claims) {
        if (!rewritten) {
          const res = NextResponse.next();
          res.headers.set("x-device-id", claims.device_id);
          if (claims.user_id) res.headers.set("x-device-user", claims.user_id);
          if (claims.org_id) res.headers.set("x-device-org", claims.org_id);
          if (claims.role) res.headers.set("x-device-role", claims.role);
          if (claims.kiosk) res.headers.set("x-device-kiosk", "1");
          if (claims.outlet_id) res.headers.set("x-device-outlet", claims.outlet_id);
          return res;
        }
        const url = request.nextUrl.clone();
        url.pathname = rewritten;
        const res = NextResponse.rewrite(url);
        res.headers.set("x-device-id", claims.device_id);
        if (claims.user_id) res.headers.set("x-device-user", claims.user_id);
        if (claims.org_id) res.headers.set("x-device-org", claims.org_id);
        if (claims.role) res.headers.set("x-device-role", claims.role);
        if (claims.kiosk) res.headers.set("x-device-kiosk", "1");
        if (claims.outlet_id) res.headers.set("x-device-outlet", claims.outlet_id);
        return res;
      }
    }
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    return NextResponse.redirect(url);
  }
}

export default middleware;

export const config = {
  matcher: [
    // Match all application routes except static assets.
    "/((?!.*\\..*|_next).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};
