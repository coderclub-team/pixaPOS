"use client";

import { useFirstRunRedirect } from "@/hooks/use-first-run-redirect";

/** Client-side dashboard guards that need browser session state. */
export default function DashboardGuards() {
  useFirstRunRedirect();
  return null;
}
