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

## Workflows

Invoke via slash command or shorthand. Each workflow injects the appropriate persona at invocation time.
Definitions: `.agents/skills/`

| Command | Persona | Purpose |
|---|---|---|
| `/skill:spec` | @Spec | Write or update a living spec (Blueprint + Contract) |
| `/skill:dev` | @Dev | Implement a task against a spec, using subagents |
| `/skill:critic` | @Critic | Adversarial review of current changes against specs + boundaries |
| `/skill:ship` | @Ship | Lint → build → test → spec-verify → commit → push |
| `/skill:planner` | @Planner | Decompose a feature into atomic, dependency-ordered GitHub issues |
| `/skill:assemble` | @Assemble | Dev→Critic loop: implement + review until clean (max 3 cycles) |
| `/skill:next-task` | @Backlog | Pick the highest-value/lowest-effort task from open issues |

### Multi-model Assemble

When the user says **"assemble N"** (where N is a GitHub issue number), run:

```bash
./scripts/assemble.sh N
```

This spawns a fully automated Dev→Critic loop using separate models with clean contexts:

| Role | Model selector | Provider | Tools |
|---|---|---|---|
| Dev (implement) | `gemini-3-flash-preview` | `google-gemini-cli` | read, bash, edit, write |
| Critic (review) | `gpt-5-mini` | `github-copilot` | read, bash |

The script:
1. Generates a Task Brief from the issue (`gh issue view`), relevant specs, and project context
2. Runs Dev sub-agent (`pi -p --no-session`) with the dev skill and full tool access
3. Runs Critic sub-agent (`pi -p --no-session`) with the critic skill, git diff, and read-only tools
4. Parses the critic verdict: **Ship it** → done, **Fix before commit** → re-run Dev with findings, **Discuss** → stop for human
5. Circuit-breaker at 3 cycles (override: `./scripts/assemble.sh N --max-cycles 5`)

After completion, report the verdict and suggest `/skill:ship` if clean.

Helper scripts live in `.agents/skills/assemble/scripts/`.
Model selectors can be overridden via env vars: `DEV_MODEL`, `DEV_PROVIDER`, `CRITIC_MODEL`, `CRITIC_PROVIDER`.

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

## Model Routing

This project uses Cascading Model Routing per ASDLC methodology:

| Task | Model Tier | Rationale |
|---|---|---|
| Spec authoring, architecture, epic decomposition | Frontier (Opus 4.6 / Gemini 3 High) | Requires deep reasoning, taste alignment |
| Implementation, iteration, test writing | Fast (Gemini 3 Flash) | High throughput, low latency, well-constrained by Specs |
| Adversarial review | Frontier or cross-model | Must catch violations the builder model might miss |

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
