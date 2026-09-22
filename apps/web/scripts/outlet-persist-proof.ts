/** Throwaway: proves outlet mock survives a module reload via localStorage. */
const store = new Map<string, string>();
// @ts-expect-error browser stub
globalThis.window = {};
// @ts-expect-error browser stub
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

async function main(): Promise<void> {
  const tag = Date.now().toString(36);
  const s1 = await import(`../features/outlet/api/service.ts?t=${tag}`);
  await s1.updateOutlet({ logo_url: "https://cdn.test/logo.png", name: "Proven Outlet" });
  const before = await s1.getOutlet();
  console.log("before reload:", before.logo_url, "|", before.name);

  const s2 = await import(`../features/outlet/api/service.ts?t=${tag}x`);
  const after = await s2.getOutlet();
  console.log("after reload: ", after.logo_url, "|", after.name);
  console.log("UPI accounts:", after.upi_ids.length);

  if (after.logo_url !== "https://cdn.test/logo.png" || after.name !== "Proven Outlet") {
    console.error("PERSISTENCE BROKEN");
    process.exit(1);
  }
  console.log("PERSISTENCE OK");
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
