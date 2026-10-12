import { NextResponse } from "next/server";
import { baHas, baOrgId, baSession } from "@/lib/auth-session";

/** Session + active-org gate shared by all payroll routes. */
export async function payrollAuth(
  permission?: string,
): Promise<{ organizationId: string; userId: string } | NextResponse> {
  let session = null;
  try {
    session = await baSession();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const organizationId = await baOrgId().catch(() => null);
  if (!organizationId) {
    return NextResponse.json({ error: "no active organization" }, { status: 400 });
  }
  if (permission && !(await baHas(permission).catch(() => false))) {
    return NextResponse.json({ error: `forbidden: ${permission} required` }, { status: 403 });
  }
  return { organizationId, userId: session.user.id };
}

/** Runtime guard: approved runs are immutable. */
export function assertDraft(status: string): NextResponse | null {
  if (status !== "draft") {
    return NextResponse.json({ error: "payroll run is approved and read-only" }, { status: 409 });
  }
  return null;
}

export const noStore = { "Cache-Control": "no-store" } as const;
