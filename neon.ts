import { defineConfig } from "@neon/config/v1";

// pixaPOS → Neon full-stack (branch: migrate/neon-full-stack)
// - DB: Lakebase Postgres (replaces Layerbase) — schema 0000–0031, self-managed Better Auth
// - Storage: already on Neon object storage (files-sdk/neon) — buckets declared here
// - Functions: usage-sync forwarder + scheduled trigger (mirrors vercel.json cron)
// - No Managed Auth — we keep self-managed Better Auth (packages/server/src/auth.ts)

export default defineConfig({
  buckets: {
    "outlet-assets": { access: "public_read" },
    "menu-images": { access: "public_read" },
  },
  functions: {
    "usage-sync": {
      name: "usage-sync forwarder",
      source: "neon/functions/usage-sync.ts",
    },
  },
  triggers: {
    "usage-sync-daily": {
      type: "schedule",
      function: "usage-sync",
      cron: "0 3 * * *",
    },
  },
  branch: (branch) => {
    if (branch.exists) return {};
    // Ephemeral dev/migration branches: scale-to-zero, cheap, auto-cleanup.
    // Production branch stays warm (no TTL, default compute) — created manually and marked protected.
    if (branch.name.startsWith("dev") || branch.name.startsWith("migrate/")) {
      return {
        ttl: "7d",
        postgres: {
          computeSettings: {
            autoscalingLimitMinCu: 0.25,
            autoscalingLimitMaxCu: 1,
            suspendTimeout: "5m",
          },
        },
      };
    }
    return {};
  },
});
