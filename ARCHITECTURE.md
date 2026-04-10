# Architecture

## Data Flow

```
User Input → Svelte UI → Grid Manager (state) → Threlte Renderer (visuals)
                                               → Physics Controller (simulation)
                                                    ↓
                                               Score Manager (stunt detection)
                                                    ↓
                                               UI (HUD + high scores) ↔ localStorage

Editor Mode: UI ↔ Grid Manager ↔ Renderer (preview)
Drive Mode:  Input → Physics Controller → Renderer (chase camera)
                                        → Score Manager → UI (score HUD)
```

All game state lives in Svelte stores. There is no separate engine runtime. The Grid Manager owns track state, the Physics Controller owns vehicle state, and the Renderer is a pure view layer that reads from both.

## Module Boundaries

### Grid Manager (`src/lib/grid/`)
- Owns the fixed 16×16 2D grid representing the track layout
- Each cell is either empty or contains one tile (type + rotation). No y-axis — height is implicit per tile type (bridge tiles are elevated).
- Pure logic — no rendering, no physics components. Svelte 5 runes (`$state`, `$derived`) are allowed for reactivity, but no UI components or DOM dependencies.
- Exports typed track data that other modules consume
- Input: user placement actions. Output: track data structure.

### Physics Controller (`src/lib/physics/`)
- Owns vehicle physics (RaycastVehicle via Rapier.js) and collision meshes
- Reads track data to generate collision geometry
- Independent of visual meshes — collision shapes may differ from rendered shapes
- Tunable parameters (speed, gravity, bounce) are exported constants, not magic numbers

### 3D Renderer (`src/lib/components/`)
- Threlte/Svelte components that map Grid Manager data to Kenney.nl 3D assets
- Declarative — reacts to state changes, does not own state
- Kenney.nl toy assets rendered as-is (bright, glossy, plastic look)
- Paper/cardboard environment shaders applied to scenery only — not to cars or track pieces
- Chase camera logic lives here

### Score Manager (`src/lib/scoring/`)
- Pure TypeScript logic — detects stunt events and calculates points
- Reads from Physics Controller state: airtime, rotation, speed, loop completion, near-misses
- Does NOT read from Renderer or UI
- Emits score events that UI and Renderer can subscribe to (for HUD updates and visual feedback)
- High scores persisted to localStorage, keyed by the serialized track URL string
- No server calls — all local

### UI Layer (`src/lib/ui/`)
- Standard Svelte components overlaying the 3D canvas
- Menus, editor palette, share dialogs, HUD, score display, high-score table
- Communicates with Grid Manager via Svelte stores
- Does not touch physics or rendering internals

## Boundary Rules

- Grid Manager MUST NOT import from physics, scoring, rendering, or UI components (Svelte logic primitives like `$state` are permitted)
- Physics Controller MUST NOT import from scoring, rendering, or UI
- Score Manager reads Physics Controller state only — MUST NOT import from Grid Manager, Renderer, or UI
- Renderer MUST NOT mutate Grid Manager or Score Manager state — read only
- UI MUST NOT directly manipulate the 3D scene — only Grid Manager state and Score Manager reads
- Track data type (`src/lib/types/track.ts`) is the cross-module contract. Changes require Spec update.

## State Management

- Game mode state (Menu → Editor → Drive → Replay) lives in a Svelte store
- Track data is the single shared format, defined in `src/lib/types/track.ts`
- No server state. Everything is client-side. Tracks live in URLs.
- High scores live in localStorage, keyed by the serialized track URL string (the URL is the track identity — no hashing, no indirection)
- State transitions are explicit — no implicit mode detection

## Track Data as Contract

The track data format is the most architecturally sensitive surface. It is consumed by:
- Grid Manager (writes it)
- Physics Controller (reads it for collision)
- Renderer (reads it for visuals)
- URL serializer (encodes/decodes for sharing)

Any change to the track format is a breaking change across all four consumers. The format is defined in `specs/track-format.spec.md` and enforced by the TypeScript type in `src/lib/types/track.ts`.

## Performance Targets

- First contentful paint: < 2s on 4G
- Time-to-interactive (first jump): < 10s from page load
- Stable 60fps on mid-range laptop (2020 MacBook Air equivalent)
- Track encode/decode: < 5ms for a full 16×16 grid (256 cells)
- Total bundle size: < 5MB including assets
