---
name: spec
description: "Write or update an ASDLC living spec (Blueprint + Contract) for a feature"
argument-hint: "[feature name or description]"
---

Write an ASDLC spec for the following feature request:

$ARGUMENTS

## Instructions

You are writing a spec for Paper Cars 2 — a browser-based stunt racing sandbox built with Svelte 5 + Threlte + Rapier.js. Read these files for context before writing:

1. Read `VISION.md` for product principles and decision heuristics
2. Read `ARCHITECTURE.md` for module boundaries, data flow, and boundary rules
3. Read `AGENTS.md` for hard constraints and judgment boundaries
4. Read existing specs in `specs/` to understand scope boundaries and avoid overlap

## Output

Create a new file at `specs/<feature-slug>.spec.md` following this exact structure:

```markdown
# <Feature Name>

## Blueprint (Design)

### Context
Why does this feature exist? What problem does it solve for players? Reference VISION.md decision heuristics when making trade-offs (fun over correctness, fast over complete, etc.)

### Architecture
- Which modules are involved (Grid Manager, Physics Controller, Score Manager, Renderer, UI)
- Data flow: what data enters, transforms, and exits this feature
- Svelte stores and TypeScript types affected
- Integration points with existing modules — reference ARCHITECTURE.md boundary rules

### Anti-Patterns
What must NOT be done. Include at least:
- Patterns that would violate module boundary rules in ARCHITECTURE.md
- Common implementation mistakes for this kind of feature
- Approaches that would break the single-codebase constraint

## Contract (Quality)

### Definition of Done
Observable, testable success criteria. Each criterion should map to at least one test.

### Regression Guardrails
Invariants that must never break — things that are true today and must remain true after this feature ships.

### Scenarios (Gherkin)
Behavioral specs as Given/When/Then. Cover:
- Happy path
- Boundary conditions (e.g. edge of grid, zero speed, max score)
- Error / edge cases
- Performance (e.g. 60fps during loops, track encode < 50ms)
```

## Rules

- Reference specific ARCHITECTURE.md module boundaries rather than inventing new cross-module dependencies
- If the feature requires a new Svelte store, new event type, or new shared TypeScript type, flag it with a "**New API surface**" callout — these affect the cross-module contract
- Track data format changes are breaking changes across four consumers (Grid Manager, Physics, Renderer, URL serializer) — flag these prominently
- Keep the spec focused on ONE feature — if the request implies multiple features, write the spec for the core one and note the others as "Related / Future"
- Physics specs must include specific numeric thresholds (speeds, forces, angles) — "fast enough" is not a spec
- Do not write implementation code — this is a spec, not a PR

After writing the spec, show which test files need scenarios and ask if the spec should be committed.
