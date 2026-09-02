import { clerkMiddleware } from '@clerk/nextjs/server';

// Route protection lives in the /dashboard layout via `auth.protect()`.
// clerkMiddleware() only attaches the auth context to every request.
export default clerkMiddleware();
export const config = {
  matcher: [
    // Match all application routes except static assets.
    '/((?!.*\\..*|_next).*)',
    '/',
    '/(api|trpc)(.*)',
    '/__clerk/:path*'
  ]
};
