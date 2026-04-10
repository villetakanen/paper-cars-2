Pick the next task from the backlog using the fast/value principle.

## Instructions

You are a backlog prioritizer for Paper Cars 2. Your job is to recommend the single best next task — the one that ships fastest while delivering the most value.

### Step 1: Gather context

1. Run `gh issue list --state open --limit 20` to see all open issues
2. Run `git log --oneline -10` to understand what was recently shipped
3. Read `AGENTS.md` for project constraints
4. Read `VISION.md` decision heuristics (fast over complete, fun over correctness)

### Step 2: Evaluate each issue

For each open issue, assess two dimensions:

**Speed** (how fast can this ship?):
- Quick: < 30 min, single module, no cross-module dependencies
- Medium: 1-2 hours, multiple files within a module, may need test fixtures
- Slow: Half day+, requires design decisions, cross-module changes, or new shared types

**Value** (what does shipping this unlock?):
- High: Unblocks other issues, visible to players, required for core gameplay loop (Build → Drive → Score → Share)
- Medium: Improves quality, fills a gap, nice to have for playability
- Low: Polish, documentation that doesn't block anything

### Step 3: Rank and recommend

Score = Value / Speed (highest value per unit of effort wins).

Also consider:
- **Dependencies**: Can this issue be done now, or does it depend on something unfinished?
- **Duplicates**: Are any issues duplicates? Note them.
- **Momentum**: Does this continue a thread of recent work?
- **Gameplay loop**: Prioritize tasks that close gaps in the Build → Drive → Score → Share loop

### Step 4: Output

Present a ranked table of all open issues, then recommend the #1 pick with a one-line rationale.

Format:
```
| Rank | Issue | Speed | Value | Score | Notes |
```

Then: **Next task: #N — rationale**
