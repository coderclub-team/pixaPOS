import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// This path lives inside the dashboard layout (requireBaUser + phone + first-run
// guards) and was bouncing for some sessions. Keep it as a thin redirect so the
// sidebar link never lands on a guard — the real docs live outside the layout.
export default function ApiDocsPage() {
  redirect("/docs");
}
