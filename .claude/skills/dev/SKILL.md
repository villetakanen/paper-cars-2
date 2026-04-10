---
name: dev
description: "Implement a task against a spec using subagents for parallel work"
argument-hint: "[issue number, task description, or spec reference]"
---

Implement the following task:

$ARGUMENTS

## Instructions

You are implementing a task for Paper Cars 2. This command orchestrates work using subagents.

### Step 1: Understand the task

1. If a GitHub issue number is given, fetch details with `gh issue view <number>`
2. Read the spec referenced in the issue (if any) from `specs/`
3. Read `AGENTS.md` for hard constraints and judgment boundaries
4. Read `ARCHITECTURE.md` for module boundaries and data flow
5. Read the source files listed in "Files Likely Touched"

### Step 2: Plan the implementation

Before writing code, create a brief plan:

- What changes are needed in each module (Grid, Physics, Scoring, Renderer, UI)
- What tests need to be written or updated
- What the commit message(s) will be
- Which ARCHITECTURE.md boundary rules apply to this change

### Step 3: Implement using subagents

Use the Agent tool to parallelize independent work. Delegate to subagents for:

**Research / exploration subagents** (subagent_type: Explore):
- Investigating how existing modules work before making changes
- Finding all consumers of a type or store being modified
- Understanding test patterns used in the existing test suite

**Implementation subagents** (subagent_type: general-purpose):
- Writing or modifying source files in `src/lib/`
- Writing or updating unit tests in `tests/unit/`
- Writing or updating e2e tests in `tests/e2e/`

### Subagent guidelines

- Only parallelize truly independent work (e.g., unit tests for Grid Manager and Score Manager)
- Do NOT parallelize source changes that touch the same module
- Each subagent should receive: the relevant spec section, the file(s) to read/modify, and the acceptance criteria it's fulfilling
- Subagents must follow AGENTS.md constraints (Biome formatting, strict TS, no `any`, no unauthorized dependencies)
- Subagents must respect ARCHITECTURE.md boundary rules (Grid Manager doesn't import from Physics, etc.)

### Step 4: Verify

After implementation, run these checks sequentially:

1. `pnpm check` — Biome lint + format
2. `pnpm typecheck` — TypeScript strict mode
3. `pnpm test` — Vitest unit tests
4. Fix any failures before proceeding

### Step 5: Report

After verification passes, report back:

1. What was done (files changed, tests added)
2. Which spec scenarios are now satisfied
3. If implementation revealed new constraints, note what spec updates are needed (Learning Loop)
4. Any open questions

Do NOT commit, push, or close the issue — that is `/ship`'s job.

## Rules

- Never skip the verification step — all three checks must pass
- If a check fails, fix it before proceeding
- If the task is blocked (missing dependency, spec ambiguity), stop and ask rather than guessing
- Do NOT commit, push, or close issues — the user controls git and GitHub operations
- Do not modify files outside the module scope of the task without asking
- If the task's acceptance criteria can't all be met, explain what's missing and why
- Physics code must use tunable exported constants, not magic numbers
- Fun over correctness — if the math says no but it looks like it should work, fudge the math (but comment why)
