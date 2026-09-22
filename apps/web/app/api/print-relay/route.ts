import { NextResponse } from "next/server";
import { createConnection } from "node:net";

/**
 * Dev-only print relay: forwards ESC/POS bytes from the browser to a TCP
 * printer (real hardware or lezram/escpos-emulator on :9100). Browsers cannot
 * open raw sockets, so this same-origin route does the TCP leg server-side.
 * Not for production without auth + allowlisting.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRINT_RELAY !== "1") {
    return NextResponse.json({ error: "print relay disabled" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as {
    host?: string;
    port?: number;
    bytesBase64?: string;
  } | null;
  if (!body?.host || !body?.bytesBase64) {
    return NextResponse.json({ error: "host + bytesBase64 required" }, { status: 400 });
  }
  const bytes = Buffer.from(body.bytesBase64, "base64");
  const port = body.port ?? 9100;
  try {
    await new Promise<void>((resolve, reject) => {
      const socket = createConnection({ host: body.host as string, port }, () => {
        socket.write(bytes, (err) => {
          socket.end();
          if (err) reject(err);
          else resolve();
        });
      });
      socket.on("error", reject);
      socket.setTimeout(8000, () => {
        socket.destroy();
        reject(new Error("printer tcp timeout"));
      });
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "relay failed" },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, bytes: bytes.length });
}
