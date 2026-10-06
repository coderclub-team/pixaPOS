import { NextResponse } from "next/server";

/**
 * Hub health probe: devices on the LAN use this to detect a reachable hub
 * (counter PC serving this same build) and to distinguish hub from cloud.
 * No auth — it reveals only liveness, never data.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "pixapos-web",
    mode: process.env.PIXA_HUB_MODE === "true" ? "hub" : "cloud",
    time: new Date().toISOString(),
  });
}
