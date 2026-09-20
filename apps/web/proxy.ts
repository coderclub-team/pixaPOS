import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

// Session attach + app gates. Public paths: auth pages, API auth,
// static assets. /dashboard and the /kds wallboard require a Better Auth
// session (the wallboard shows live order data — never anonymous).
const PUBLIC_PREFIXES = ["/auth/", "/api/auth/"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  if (!pathname.startsWith("/dashboard") && pathname !== "/kds") {
    return NextResponse.next();
  }
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/sign-in";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  } catch {
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
