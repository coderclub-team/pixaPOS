import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { appliedCommands, db } from "@pixa/db";
import type { CommandEnvelope, PushResult } from "@pixa/contracts";

const ENABLED = process.env.PIXA_SYNC_ENABLED === "true";

/**
 * Sync push skeleton: accepts an outbox batch, dedupes by command_id via the
 * idempotency ledger, and acknowledges. Entity application lands in pilot
 * phases — until then commands are recorded as applied without mutation so
 * retry/dedupe behavior is verifiable end to end.
 */
export async function POST(req: Request) {
  if (!ENABLED) {
    return NextResponse.json({ error: "sync disabled" }, { status: 503 });
  }
  let body: { commands?: CommandEnvelope[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const commands = body.commands ?? [];
  if (!Array.isArray(commands) || commands.length > 200) {
    return NextResponse.json({ error: "batch must be 1..200 commands" }, { status: 400 });
  }
  const database = db();
  const results: PushResult[] = [];
  for (const cmd of commands) {
    if (!cmd?.command_id || !cmd?.entity_type || !cmd?.entity_id) {
      continue;
    }
    const existing = await database
      .select()
      .from(appliedCommands)
      .where(eq(appliedCommands.commandId, cmd.command_id))
      .limit(1);
    if (existing.length > 0) {
      results.push({
        command_id: cmd.command_id,
        ok: true,
        server_version: existing[0].serverVersion ?? 1,
      });
      continue;
    }
    await database.insert(appliedCommands).values({
      commandId: cmd.command_id,
      deviceId: cmd.device_id,
      entityType: cmd.entity_type,
      entityId: cmd.entity_id,
      serverVersion: 1,
    });
    results.push({ command_id: cmd.command_id, ok: true, server_version: 1 });
  }
  return NextResponse.json({ results });
}
