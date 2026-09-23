/** Throwaway: QR mode-byte A/B test against escpresso. Usage: tsx qr-ab.ts [with|without] */
const GS = 0x1d;

function qrBytes(data: string, withMode: boolean): number[] {
  const raw = Buffer.from(data.slice(0, 400), "utf8");
  const out: number[] = [];
  const store = (fn: number, payload: number[]) => {
    const len = payload.length + 2;
    out.push(GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, fn, ...payload);
  };
  store(0x41, [0x32, 0x00]);
  store(0x43, [0x04]);
  store(0x45, [0x31]);
  const d = [...raw];
  const body = withMode ? [0x30, ...d] : d;
  const len = body.length + 2;
  out.push(GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, ...body);
  out.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
  return out;
}

async function main(): Promise<void> {
  const withMode = process.argv[2] !== "without";
  const label = withMode ? "QR-WITH-MODE" : "QR-WITHOUT-MODE";
  const data = "upi://pay?pa=test@upi&pn=T&am=10.00&cu=INR&tr=T1";
  const bytes = new Uint8Array([
    0x1b,
    0x40,
    0x1b,
    0x61,
    0x01,
    ...Buffer.from(label + "\n", "utf8"),
    ...qrBytes(data, withMode),
    0x0a,
    0x0a,
    0x0a,
    0x1d,
    0x56,
    0x01,
  ]);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const res = await fetch("http://localhost:3000/api/print-relay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      host: "127.0.0.1",
      port: 9100,
      bytesBase64: Buffer.from(binary, "binary").toString("base64"),
    }),
  });
  console.log(label, "relay:", res.status, await res.text());
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
