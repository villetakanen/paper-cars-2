Plan atomically deliverable tasks for the following feature or request:

$ARGUMENTS

## Instructions

You are planning implementation work for Paper Cars 2. Before planning:

1. Read `AGENTS.md` for hard constraints, judgment boundaries, and model routing
2. Read `ARCHITECTURE.md` for module boundaries and data flow
3. Read `VISION.md` for product direction and decision heuristics
4. If a spec exists for this feature in `specs/`, read it — the spec is the authority
5. If no spec exists, tell the user to run `/spec` first, unless the request is a bug fix or chore that doesn't need a spec

Then check the current state of the codebase and GitHub issues to understand what already exists.

## Planning Rules

Each task must be **atomically deliverable** — it can be implemented, tested, and committed independently. A task is atomic when:

- It produces a working state (tests pass, lint passes, types check)
- It does not depend on uncommitted work from another task
- It can be described in one conventional commit message
- It is small enough for a single focused implementation session
- It stays within module boundaries (one module per task when possible)

## Output

For each task, create a GitHub issue using `gh issue create` with:

- **Title**: conventional-commit-style (`feat(scope): description` or `fix(scope): description`)
- **Labels**: one of `feat`, `fix`, `refactor`, `test`, `docs`, `chore` (create label if missing)
- **Scope**: the module name — `grid`, `physics`, `scoring`, `renderer`, `ui`, `track-format`, `infra`
- **Body** containing:

```markdown
## Context
One paragraph: what this task does and why, referencing the spec if applicable.

## Spec Reference
`specs/<name>.spec.md` — <relevant section or scenario>
(or "N/A — this is a bug fix / chore" if no spec)

## Acceptance Criteria
- [ ] Criterion 1 (maps to a specific test or verification)
- [ ] Criterion 2
- ...

## Module Scope
Primary: `src/lib/<module>/`
Tests: `tests/unit/<module>.test.ts`
Boundary check: list any cross-module reads (OK) and ensure no cross-module writes

## Commit Convention
`type(scope): description`
```

## Ordering

Create issues in dependency order. If task B depends on task A, note it in B's body: `Depends on #<A>`.

Typical ordering for a new game feature:
1. Types / interfaces (if new shared types in `src/lib/types/`)
2. Core logic (Grid Manager, Physics Controller, or Score Manager)
3. Rendering (Threlte components that visualize the logic)
4. UI (Svelte components for player interaction)
5. Integration tests (e2e tests for the full feature loop)
6. Spec updates (if implementation revealed new constraints — Learning Loop)

## After Planning

List all created issues with their numbers and titles. Show the dependency graph if there are dependencies. Ask if the ordering and scope look right before the user starts `/dev`.
