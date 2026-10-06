#!/usr/bin/env node
/**
 * pixaPOS CI/CD pipeline executor.
 *
 * One dependency-free entry point to run the same validate → build → migrate
 * → health flow that `.github/workflows/ci-cd.yml` runs in CI, but locally and
 * tier-aware. Never invents behaviour: every step shells out to the exact
 * pnpm/turbo/drizzle commands the workflow uses.
 *
 * Usage:
 *   node scripts/pipeline.mjs status
 *   node scripts/pipeline.mjs verify
 *   node scripts/pipeline.mjs migrate dev|stage|prod [--yes] [--url <postgres>]
 *   node scripts/pipeline.mjs health [url ...]
 *   node scripts/pipeline.mjs deploy dev|stage|prod [--yes]
 *
 * Tier map (matches vercel.json + branch protection):
 *   dev   → develop → Vercel Development / *.develop.pixapos.store
 *   stage → test    → Vercel Preview (staging target)
 *   prod  → main    → Vercel Production
 */

import { spawnSync } from "node:child_process";

const TIERS = {
  dev: {
    branch: "develop",
    appEnv: "dev",
    secret: "DEV_DATABASE_URL",
    origin: process.env.PIXA_DEV_URL ?? "https://develop.pixapos.store",
    note: "Preview / development tier",
  },
  stage: {
    branch: "test",
    appEnv: "stage",
    secret: "STAGE_DATABASE_URL",
    origin: process.env.PIXA_STAGE_URL ?? "https://test.pixapos.store",
    note: "Staging tier",
  },
  prod: {
    branch: "main",
    appEnv: "prod",
    secret: "PROD_DATABASE_URL",
    origin: process.env.PIXA_PROD_URL ?? "https://pixapos.store",
    note: "Production — protected, PR-only",
  },
};

const SURFACES = ["", "app.", "pos.", "kds.", "admin."];

function sh(cmd, args, opts = {}) {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false,
    env: { ...process.env, ...opts.env },
  });
  if (res.status !== 0) {
    console.error(`\n✖ Step failed: ${cmd} ${args.join(" ")}`);
    process.exit(res.status ?? 1);
  }
}

function capture(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: "utf8" });
  return { ok: res.status === 0, out: (res.stdout ?? "").trim(), err: (res.stderr ?? "").trim() };
}

function tier(name) {
  const t = TIERS[name];
  if (!t) {
    console.error(`Unknown tier "${name}". Expected one of: ${Object.keys(TIERS).join(", ")}`);
    process.exit(1);
  }
  return t;
}

function currentBranch() {
  return capture("git", ["rev-parse", "--abbrev-ref", "HEAD"]).out;
}

function isClean() {
  return capture("git", ["status", "--porcelain"]).out === "";
}

function resolveDbUrl(name, flags) {
  if (flags.url) return flags.url;
  return process.env[TIERS[name].secret] ?? "";
}

function requireConfirmation(name, flags) {
  if (name !== "prod" || flags.yes || process.env.CONFIRM_PROD === "1") return;
  console.error(
    "\n✖ Refusing to run against PRODUCTION without confirmation.\n" +
      "  Re-run with --yes (or CONFIRM_PROD=1) once you are certain.",
  );
  process.exit(1);
}

function parseFlags(argv) {
  const flags = { yes: false, url: "" };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--yes" || argv[i] === "-y") flags.yes = true;
    else if (argv[i] === "--url") flags.url = argv[++i] ?? "";
    else rest.push(argv[i]);
  }
  return { flags, rest };
}

// --- commands -----------------------------------------------------------

function cmdStatus() {
  const branch = currentBranch();
  const clean = isClean();
  const ahead = capture("git", ["rev-list", "--count", "@{u}..HEAD"]).out || "0";
  console.log("pixaPOS pipeline — tier map\n");
  for (const [name, t] of Object.entries(TIERS)) {
    const secretSet = process.env[t.secret] ? "set" : "unset";
    console.log(
      `  ${name.padEnd(5)} branch=${t.branch.padEnd(8)} APP_ENV=${t.appEnv.padEnd(5)} ` +
        `${t.secret}=${secretSet.padEnd(5)} origin=${t.origin}`,
    );
  }
  console.log(`\n  current branch : ${branch}`);
  console.log(`  working tree   : ${clean ? "clean" : "DIRTY"}`);
  console.log(`  commits ahead  : ${ahead}`);
  const active = Object.entries(TIERS).find(([, t]) => t.branch === branch)?.[0] ?? "none";
  console.log(`  active tier    : ${active}`);
}

function cmdVerify() {
  console.log("Running CI validate + build (mirrors ci-cd.yml)…");
  sh("pnpm", ["format:check"]);
  sh("pnpm", ["lint"]);
  sh("pnpm", ["typecheck"]);
  sh("pnpm", ["build", "--filter", "@pixa/web"]);
  console.log("\n✓ verify passed");
}

function cmdMigrate(args) {
  const { flags, rest } = parseFlags(args);
  const name = rest[0];
  if (!name) {
    console.error("Usage: pipeline.mjs migrate dev|stage|prod [--yes] [--url <postgres>]");
    process.exit(1);
  }
  const t = tier(name);
  requireConfirmation(name, flags);
  const url = resolveDbUrl(name, flags);
  if (!url) {
    console.error(
      `\n✖ No database URL. Export ${t.secret} (or pass --url).\n` +
        `  Migrations promote dev → stage → prod, never prod first.`,
    );
    process.exit(1);
  }
  console.log(`Migrating ${name} (APP_ENV=${t.appEnv})…`);
  sh("pnpm", ["exec", "drizzle-kit", "migrate", "--config", "./drizzle.config.ts"], {
    env: { DATABASE_URL: url, APP_ENV: t.appEnv },
  });
  console.log(`\n✓ ${name} schema migrated`);
}

async function cmdHealth(args) {
  const target = args[0] ? args : Object.values(TIERS).map((t) => t.origin);
  let failed = 0;
  for (const base of target) {
    const root = base.replace(/\/$/, "");
    for (const s of SURFACES) {
      const url = `${root.replace("://", `://${s}`)}/api/health`;
      try {
        const res = await fetch(url, { redirect: "manual" });
        const ok = res.ok || res.status === 307 || res.status === 308;
        console.log(`${ok ? "✓" : "✖"} ${res.status} ${url}`);
        if (!ok) failed++;
      } catch (e) {
        console.log(`✖ ERR ${url} — ${e.message}`);
        failed++;
      }
    }
  }
  if (failed) {
    console.error(`\n✖ ${failed} health check(s) failed`);
    process.exit(1);
  }
  console.log("\n✓ all health checks passed");
}

function cmdDeploy(args) {
  const { flags, rest } = parseFlags(args);
  const name = rest[0];
  if (!name) {
    console.error("Usage: pipeline.mjs deploy dev|stage|prod [--yes]");
    process.exit(1);
  }
  const t = tier(name);
  requireConfirmation(name, flags);
  const branch = currentBranch();
  if (branch !== t.branch) {
    console.error(`\n✖ You are on "${branch}" but ${name} deploys from "${t.branch}".`);
    process.exit(1);
  }
  if (!isClean()) {
    console.error("\n✖ Working tree is dirty. Commit or stash before deploying.");
    process.exit(1);
  }
  console.log(`Deploying ${name}: verify → push origin/${t.branch}`);
  cmdVerify();
  sh("git", ["push", "origin", t.branch]);
  console.log(`\n✓ pushed origin/${t.branch}. Vercel Git integration deploys ${t.note}.`);
  console.log(`  Promote order: develop → test → main (PR + required checks).`);
}

function usage() {
  console.log(`pixaPOS pipeline

  status                              show tier map + branch state
  verify                              run CI validate + web build locally
  migrate <dev|stage|prod> [--yes]    apply migrations to a tier (prod guarded)
  health [url ...]                    probe /api/health across surfaces
  deploy <dev|stage|prod> [--yes]     verify then push the tier branch`);
}

const [cmd, ...args] = process.argv.slice(2);
switch (cmd) {
  case "status":
    cmdStatus();
    break;
  case "verify":
    cmdVerify();
    break;
  case "migrate":
    cmdMigrate(args);
    break;
  case "health":
    await cmdHealth(args);
    break;
  case "deploy":
    cmdDeploy(args);
    break;
  default:
    usage();
}
