# AGENTS.md

> **Project:** Paper Cars 2 — a Stunts-inspired browser racing game with papercraft aesthetics.
> **Core constraint:** Pure web application. Single codebase, single toolchain. No engine binaries, no WASM bridges, no separate build pipelines. Read `VISION.md` for product taste and decision heuristics.

## Toolchain

| Action | Command | Authority |
|---|---|---|
| Dev server | `pnpm dev` | Vite config — see `vite.config.ts` |
| Build | `pnpm build` | Vite config |
| Test (unit) | `pnpm test` | Vitest — see `vitest.config.ts` |
| Test (E2E) | `pnpm test:e2e` | Playwright — see `playwright.config.ts` |
| Lint + Format | `pnpm check` | Biome — see `biome.json` |
| Type check | `pnpm typecheck` | `tsconfig.json` is the authority |

## Judgment Boundaries

**NEVER**
- Commit secrets, API keys, or `.env` files
- Add npm dependencies without discussion
- Use `any` type in TypeScript — find or create proper types
- Introduce a build step that requires tools outside the Node.js ecosystem
- Skip tests to ship faster — the testing Spec exists for a reason (PC1 Lesson #3)

**ASK**
- Before adding a new npm dependency
- Before changing the track data format (breaking change — requires Spec update)
- Before modifying CI workflows or build config
- When a Spec is ambiguous — stop and ask, do not guess (PC1 Lesson #4)

**ALWAYS**
- Read the relevant Spec before writing code
- Explain your plan before implementing
- Update the relevant Spec in `/specs/` when changing feature behavior (same-commit rule)
- Write or update tests for any new functionality
- Use micro-commits: one logical change per commit

## Context Map

```yaml
stack: Svelte 5 + TypeScript strict + Threlte + Rapier.js

src/:
  lib/grid/:       "Grid Manager — track builder logic. Svelte 5 runes ($state/$derived) permitted; no UI components, no DOM."
  lib/physics/:    "Physics Controller — RaycastVehicle, collision meshes. No visuals."
  lib/scoring/:    "Score Manager — stunt detection, point calculation, localStorage high scores."
  lib/components/: "Threlte/Svelte 3D components — maps Grid data to Kenney assets. Toy cars, paper scenery."
  lib/ui/:         "Svelte UI layer — menus, editor chrome, share dialogs, score HUD, high-score table."
  lib/types/:      "Shared TypeScript types. Track format is the cross-module contract."

specs/:            "Living Specs (Blueprint + Contract). One per feature domain."
.agents/workflows/:  "Orchestration workflows (Workflow as Code pattern)."
tests/:
  unit/:           "Vitest — pure functions, serialization, grid logic."
  e2e/:            "Playwright — browser integration, game loads, input response."

assets/:           "Kenney.nl CC0 3D kits only. No other asset sources."
```

## Documentation Index

| File | Purpose |
|---|---|
| `VISION.md` | Product taste, aesthetic direction, decision heuristics, PC1 lessons |
| `ARCHITECTURE.md` | Data flow, module boundaries, state management, performance targets |
| `specs/game-physics.spec.md` | Car physics model, gravity, collisions, ramp behavior |
| `specs/grid-manager.spec.md` | Grid state engine, placement API, invariants |
| `specs/track-editor.spec.md` | Editor UX, piece palette, placement rules |
| `specs/track-format.spec.md` | Track serialization, URL encoding, versioning |
| `specs/rendering.spec.md` | Visual style: toy cars + paper scenery, shaders, camera |
| `specs/scoring.spec.md` | Stunt detection, point values, multipliers, localStorage high scores |
| `specs/testing.spec.md` | Test layers, tools per layer, boundary mocking strategy |
