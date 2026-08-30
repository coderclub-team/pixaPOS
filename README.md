pixaPOS workspace

Overview
- Monorepo skeleton with apps/web (Next.js) and apps/mobile (Expo)
- Shared packages in /packages (ui, types, config)
- Shared UI package `@pixa/ui` supports web + native with platform-specific files

Usage
1. Install dependencies: pnpm install
2. Start web: pnpm run dev:web
3. Start mobile: pnpm run dev:mobile
4. Generate shadcn components in web app: `pnpm --filter @pixa/web dlx shadcn@latest add <component>`

Defaults
- Package manager: pnpm
- Monorepo: pnpm workspaces

Change preferences by editing package.json and pnpm-workspace.yaml.
