# Product Vision: Paper Cars 2

**Document Status:** Draft (Iteration 5)
**Project Name:** Paper Cars 2
**Genre:** 3D Browser-Based Stunt Racing & Track Building Sandbox
**Primary Inspiration:** Stunts / 4D Sports Driving (1990)

---

## 1. The Actual Humans

**Ville** — A developer and retro gaming enthusiast who grew up on Stunts (4D Sports Driving). Wants a browser game he can share with a link, no install. Values the physics-defying fun of loop-the-loops, corkscrews, and impossible jumps over simulation realism. Built Paper Cars 1 in Godot WASM and learned the hard way that dual-runtime agentic engineering doesn't work.

**Casual players** — Anyone with 5 minutes and a browser tab. They want instant fun: no account, no tutorial longer than one screen, no loading spinner.

**Hobby developers** — People who stumble on the GitHub repo and think "I could add a track piece." The codebase should be inviting, not intimidating. Pure web stack means they can contribute without learning Godot.

## 2. Point of View

- **Toy physics over simulation.** Cars should feel like matchbox cars on a paper track — bouncy, forgiving, fun. If a player flies off a ramp and lands upside-down, that's a feature.
- **Toy cars in a paper town.** The cars and track pieces are bright, chunky Kenney.nl toys — plastic, glossy, tactile. The *environment* is a cardboard diorama: folded paper buildings, crayon-drawn skyboxes, a desk lamp as the sun. The contrast between shiny toy cars and handmade paper scenery is the visual identity.
- **Instant gratification.** The game loads fast, plays immediately. Time-to-first-jump should be under 10 seconds from page load.
- **Track editor is the game.** Building tracks is at least as fun as driving them. Sharing tracks via URL is a first-class feature.
- **Single-player first, multiplayer later.** Ghost races and time trials before any netcode.
- **Stunts are the score.** Finishing a track is easy. The challenge is style: jumps, loops, barrel rolls, near-misses. The scoring system rewards creative driving, not just speed. High scores live in localStorage — no accounts, no servers, no friction.
- **Pure web, single codebase.** No engine binaries, no WASM bridges, no separate build pipelines. One codebase that AI agents can read, modify, and test in a single context window. This is a non-negotiable lesson from Paper Cars 1.

## 3. Taste References

**Love:**
- **Stunts / 4D Sports Driving (1990)** — The loop-the-loops, the instant replays, the track editor. The joy of building something impossible and then driving it.
- **Toy-in-a-diorama aesthetic** — Tearaway's cardboard environments, but with real toy objects sitting on them. Micro Machines, Hot Wheels playsets. The world is paper; the toys are toys.
- **Excitebike (NES)** — Simple track editor, instant play, satisfying jumps.
- **Trackmania** — The "build, drive, share" loop executed at internet scale.

**Avoid:**
- Generic Unity asset store look
- Overly complex simulation (Gran Turismo, Forza)
- Mobile game monetization patterns (timers, energy, loot boxes)
- Heavy loading screens or mandatory sign-ups

## 4. Voice and Language

- Playful and brief. Error messages should make you smile, not sigh.
- No corporate speak. "Your car fell off the world" not "An unexpected physics error occurred."
- Track names and UI copy can be whimsical. "The Corkscrew of Doom," "Grandma's Kitchen Table."
- Documentation is friendly-technical: assume competence, skip condescension.

## 5. Decision Heuristics

When in doubt, optimize for:

1. **Fun over correctness** — If it looks cool and feels good, the physics can cheat.
2. **Fast over complete** — Ship a playable loop, then iterate. A track editor with 5 pieces that works beats 50 pieces that don't.
3. **Browser-native over cross-platform** — Target modern browsers. No Electron, no mobile-first compromises.
4. **Open over proprietary** — MIT license. Standard formats where possible. Community contributions welcome.
5. **Simple over configurable** — One good default beats ten settings. Add configuration only when users ask for it.
6. **Single codebase over power** — Reject any dependency that fractures the build into separate tool ecosystems, even if it's technically superior. This is the Paper Cars 1 lesson.

## 6. Core Gameplay Loop

1. **Build:** Use an intuitive, drag-and-drop grid interface to place track tiles (straights, curves, jumps, loops, obstacles).
2. **Drive:** Instantly switch to driving mode. Experience arcade-style physics where momentum, grip, and trajectory matter.
3. **Refine:** Crash spectacularly? Instantly switch back to the editor, adjust the ramp angle or add a bank, and retry.
4. **Score:** Earn points for stunts — jumps, loops, airtime, barrel rolls, near-misses. Bigger air and crazier moves mean higher multipliers. Your best run goes on the local high-score table.
5. **Share & Compete:** Save the track and generate a unique link. Others can play the track and try to beat your high score.

## 7. Lessons from Paper Cars 1

Paper Cars 1 was an ASDLC factory experiment using Godot compiled to WebAssembly. Over ~2 days and 18 commits, the project went from empty repo to a playable car on a track. The experiment surfaced five lessons:

| # | Lesson | Severity | How PC2 Addresses It |
|---|--------|----------|----------------------|
| 1 | `/ship` workflow missing from scaffolding | High | Ship workflow is a required scaffolding artifact — see AGENTS.md |
| 2 | "PBI" jargon creates friction | Low | Use "task" or imperative language; drop Scrum/SAFe vocabulary |
| 3 | No testing spec generated | High | Testing strategy is a required Spec (`specs/testing/spec.md`) |
| 4 | Dev agent didn't delegate to sub-agents | Medium | Orchestration defined as Workflow as Code with explicit handoff steps |
| 5 | Spec + Critic agents worked well | Positive | Preserve constrained-output, single-responsibility persona pattern |

**The "Why 2?" Mandate:** The deepest lesson was architectural. Godot WASM + TypeScript created two separate software factories that agents couldn't bridge. Paper Cars 2 must be a pure web application — one codebase, one toolchain, one context for agents to work within.

**The Core Insight:** ASDLC's document-producing agents (Spec, Critic) are strong because they have constrained output formats and clear done signals. Workflow-orchestrating agents (Dev, Ship) need explicit handoff mechanisms defined in code, not instructions. Agents do not self-organize around declared boundaries — they need Workflow as Code.

## 8. Success Metrics

- **Engagement:** Average session length (Target: > 10 minutes).
- **Creation Rate:** Ratio of players who drive a track vs. players who build and save their own.
- **Replay Rate:** Average runs per track per player (indicates scoring loop is compelling).
- **Virality:** Number of tracks shared via unique URLs.
- **Agentic Velocity:** Time for the execution agent to implement a new track piece given a Spec, measured in seconds.
- **Factory Health:** Ratio of first-attempt task completions vs. tasks requiring rework after Critic review.

---

*Technical architecture: see `ARCHITECTURE.md`*
*Agent constitution and factory design: see `AGENTS.md`*
