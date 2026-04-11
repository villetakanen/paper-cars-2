# Game Physics — Physics Controller

**Document Status:** Draft
**Related Specs:** [drive-mode/spec.md](drive-mode/spec.md), [track-format.spec.md](track-format.spec.md), [rendering.spec.md](rendering.spec.md)

---

## Blueprint (Design)

### Context
Paper Cars 2 is a stunt racer, not a driving simulator. The Physics Controller exists to make toy matchbox cars feel *fun* — bouncy landings, exaggerated air, satisfying loop-the-loops — not to model real suspension dynamics. Fun over correctness (VISION.md §5 heuristic #1) governs every tuning decision.

This module bridges two concerns:

1. **Collision geometry** — generating Rapier.js rigid bodies and colliders from `TrackData` so the car has something to drive on.
2. **Vehicle simulation** — running a `RaycastVehicle` each physics tick and exporting reactive `VehicleState` for the Renderer and Score Manager to consume.

The Physics Controller is the only module that writes `VehicleState`. Every other module reads it.

### Architecture

**Module:** `src/lib/physics/`

#### New API Surface

> **New API surface — affects cross-module contract**
>
> `VehicleState` is a new TypeScript interface exported by the Physics Controller and consumed by:
> - **Renderer** (`src/lib/components/`) — drives car mesh position/rotation and chase camera
> - **Score Manager** (`src/lib/scoring/`) — reads airtime, speed, and rotation for stunt detection
>
> Any change to `VehicleState` fields requires coordinating updates in both consumers.

```ts
// src/lib/physics/types.ts  (new file)
export interface VehicleState {
  position: { x: number; y: number; z: number };  // world-space, metres
  rotation: { x: number; y: number; z: number; w: number };  // quaternion
  speed: number;           // m/s, always positive (scalar)
  velocityY: number;       // m/s, signed (positive = ascending)
  isAirborne: boolean;     // true when all wheels are off any surface
  airtime: number;         // seconds spent continuously airborne (resets on landing)
  angularVelocity: { x: number; y: number; z: number };  // rad/s
}
```

#### Data Flow

```
TrackData (from Grid Manager)
  → PhysicsController.buildCollisionWorld()
      → Rapier World (static rigid bodies per tile)

Per-tick (60 Hz):
  InputVector → PhysicsController.applyInput()
      → Rapier RaycastVehicle step
          → VehicleState (reactive $state export)
              → Renderer (car mesh + camera)
              → Score Manager (stunt events)
```

#### Coordinate System

- **World units:** 1 unit = 1 metre (aligns with `TILE_SIZE = 1.0` in `src/lib/components/constants.ts`).
- **Y-axis:** Up. Ground level = `y = 0`.
- **Grid-to-world:** tile at `(gridX, gridZ)` has world centre at `(gridX * TILE_SIZE, 0, gridZ * TILE_SIZE)`.
- **Rotation convention:** tile rotation is stored in degrees clockwise (0/90/180/270); convert to radians when building colliders (`rotation_rad = rotation_deg * π / 180`).

#### Physics Engine

- **Library:** `@dimforge/rapier3d-compat` (already a project dependency via Threlte).
- **Rapier World gravity:** `{ x: 0, y: -20.0, z: 0 }` — exaggerated downward pull makes the car land faster after jumps, which feels more toy-like than real-world gravity.
- **Timestep:** fixed 1/60 s (60 Hz). Physics runs independently of render framerate; the Renderer reads the latest `VehicleState` each animation frame.
- **Broadphase:** default Rapier broadphase (DBVT). No manual tuning required for a 16×16 grid.

#### Vehicle — RaycastVehicle Configuration

The vehicle uses Rapier's `RaycastVehicle` (a.k.a. `KinematicCharacterController` chassis + wheel raycasts). Constants are exported named values from `src/lib/physics/constants.ts` — no magic numbers inline.

| Constant | Value | Notes |
|---|---|---|
| `CHASSIS_HALF_EXTENTS` | `{ x: 0.3, y: 0.1, z: 0.45 }` | Matches visual car proportions (Kenney toy car) |
| `CHASSIS_MASS` | `1.0 kg` | Rapier mass unit; tuned for snappy response |
| `WHEEL_RADIUS` | `0.12 m` | |
| `WHEEL_WIDTH` | `0.08 m` | Visual only; raycast has no width |
| `SUSPENSION_REST_LENGTH` | `0.15 m` | |
| `SUSPENSION_STIFFNESS` | `20.0` | Lower → bouncier; higher → stiffer |
| `SUSPENSION_DAMPING` | `2.3` | Critically damped ≈ 2×√stiffness; keep slightly under to allow bounce |
| `FRICTION_SLIP` | `1.0` | Lateral grip; reduce below 0.5 for ice-track future feature |
| `MAX_FORWARD_SPEED` | `25.0 m/s` | Engine cuts out above this threshold |
| `MAX_REVERSE_SPEED` | `10.0 m/s` | |
| `ENGINE_FORCE` | `15.0 N` (per wheel) | Applied to rear wheels only |
| `BRAKE_FORCE` | `20.0 N` (per wheel) | Applied to all four wheels |
| `STEER_ANGLE_MAX` | `0.5 rad` (~28.6°) | Maximum front wheel deflection |
| `STEER_INTERPOLATION` | `0.15` | Lerp factor per tick toward target steer angle (prevents snapping) |
| `RESPAWN_VELOCITY_THRESHOLD` | `0.5 m/s` | Speed below which the "stuck" timer begins |
| `RESPAWN_STUCK_DURATION` | `3.0 s` | Seconds below threshold before auto-respawn |

**Wheel layout (chassis-local positions):**

```
Front-left:  (-0.3, -0.1,  0.35)
Front-right: ( 0.3, -0.1,  0.35)
Rear-left:   (-0.3, -0.1, -0.35)
Rear-right:  ( 0.3, -0.1, -0.35)
```

Front wheels receive steering; rear wheels receive engine force and braking.

#### Input Interface

The Physics Controller exposes a single call per tick:

```ts
// src/lib/physics/controller.ts
export interface InputVector {
  throttle: number;  // 0.0 to 1.0 (forward) or -1.0 to 0.0 (reverse)
  steer: number;     // -1.0 (left) to 1.0 (right)
  brake: boolean;
  reset: boolean;    // request immediate respawn at start tile
}
```

Drive Mode (Epic 5) owns keyboard mapping → `InputVector`. The Physics Controller is input-agnostic — it does not read `window`, `document`, or any browser event.

#### Collision Geometry — Per Tile Type

Each tile occupies a `TILE_SIZE × TILE_SIZE` footprint (1.0 m × 1.0 m). The Physics Controller generates **static Rapier colliders** for every non-null cell in `TrackData.grid`. Visual mesh and collision shape may differ (ARCHITECTURE.md boundary rule); the goal is correct driving feel, not graphical accuracy.

| Tile Type | Collider Shape | Height | Notes |
|---|---|---|---|
| `STRAIGHT` | Box `(1.0 × 0.05 × 1.0)` centred at `y = 0.025` | Ground | Full-footprint flat slab |
| `CURVE` | Box `(1.0 × 0.05 × 1.0)` centred at `y = 0.025` | Ground | Identical to straight; rotation handles orientation |
| `START_FINISH` | Box `(1.0 × 0.05 × 1.0)` centred at `y = 0.025` | Ground | Same as straight; start tile is not physically special |
| `RAMP` | Inclined box `(1.0 × 0.05 × 1.0)` rotated `RAMP_PITCH_ANGLE` around X-axis, with bottom edge at `y = 0` | Ground → elevated | See ramp constants below |
| `LOOP` | 8 box segments arranged in a vertical circle of radius `LOOP_RADIUS` | Ground → `2 × LOOP_RADIUS` | See loop constants below |
| `BRIDGE` | Box `(1.0 × 0.05 × 1.0)` centred at `y = BRIDGE_ELEVATION + 0.025` | Elevated | No underside collider — car cannot drive under in v1 |

**Ramp constants:**

| Constant | Value | Notes |
|---|---|---|
| `RAMP_PITCH_ANGLE` | `0.349 rad` (20°) | Low enough to climb at moderate speed; steep enough to launch |
| `RAMP_PEAK_HEIGHT` | `TILE_SIZE × sin(RAMP_PITCH_ANGLE)` ≈ `0.342 m` | Derived; not a free constant |

**Loop constants:**

| Constant | Value | Notes |
|---|---|---|
| `LOOP_RADIUS` | `0.5 m` | Fits within the 1.0 m tile footprint |
| `LOOP_SEGMENT_COUNT` | `8` | Octagonal approximation; sufficient for toy physics |
| `LOOP_SEGMENT_THICKNESS` | `0.05 m` | Matches road slab thickness |
| `LOOP_ENTRY_RAMP_ANGLE` | `0.349 rad` (20°) | Same as `RAMP_PITCH_ANGLE`; blends entry feel |

**Bridge constant:**

| Constant | Value | Notes |
|---|---|---|
| `BRIDGE_ELEVATION` | `0.8 m` | Fixed height; must match the Kenney bridge asset visual height |

#### Airborne Detection

`isAirborne` is `true` when all four wheel raycasts miss geometry in the current tick. `airtime` accumulates in seconds while `isAirborne` is true and resets to `0` on the first tick where any wheel makes contact.

#### Respawn Logic

- When the car falls below `y = -5.0 m` (fell off the track), or
- When the car has been below `RESPAWN_VELOCITY_THRESHOLD` for `RESPAWN_STUCK_DURATION` consecutive seconds —

→ teleport chassis to the `START_FINISH` tile world position, `y = CHASSIS_HALF_EXTENTS.y + WHEEL_RADIUS + 0.05`, facing the tile's exit direction (derived from tile rotation). Zero all velocities.

If no `START_FINISH` tile exists in `TrackData`, respawn at world origin.

### Anti-Patterns

- **Importing from Renderer, UI, or Score Manager:** The Physics Controller MUST NOT import from `src/lib/components/`, `src/lib/ui/`, or `src/lib/scoring/`. `VehicleState` flows out; nothing flows in from those layers.
- **Importing from Grid Manager internals:** Read `TrackData` (the type contract) only — do not import the Grid Manager store or its reactive state. Physics builds its world once from a `TrackData` snapshot.
- **Magic numbers inline:** Every tunable parameter must be a named exported constant in `src/lib/physics/constants.ts`. Inline literals make tuning a global search-and-replace.
- **Shared Rapier World across modes:** The Rapier World must be created fresh when entering Drive Mode and destroyed when leaving. Retaining a stale world between editor sessions causes undefined collision state.
- **Polling `VehicleState` from Renderer inside the physics loop:** The Renderer reads `VehicleState` on its own animation frame tick. The physics loop writes; the renderer reads. No callbacks, no events, no shared locks.
- **Collision shapes derived from visual meshes at runtime:** Do not parse `.glb` geometry to generate collision shapes. Each tile type maps to a hard-coded Rapier primitive (box, inclined box, loop segments). Mesh-derived collision at runtime violates the "single codebase, no extra build pipeline" constraint and couples Physics to the Renderer.
- **Over-engineering suspension:** Rapier's built-in `RaycastVehicle` suspension model is sufficient. Do not implement custom spring integrators.

---

## Contract (Quality)

### Definition of Done

- [ ] `VehicleState` TypeScript interface defined in `src/lib/physics/types.ts` and consumed cleanly by Renderer and Score Manager stubs.
- [ ] `src/lib/physics/constants.ts` exports all tunable constants with JSDoc comments. Zero magic numbers in controller logic.
- [ ] `PhysicsController` can accept a `TrackData` object and produce a Rapier World with correct static colliders for all 6 tile types.
- [ ] `RaycastVehicle` responds to `InputVector`: throttle accelerates, steer turns, brake decelerates.
- [ ] `MAX_FORWARD_SPEED` is enforced; the car cannot exceed it under sustained throttle on flat ground.
- [ ] A car placed on a `RAMP` tile at rest slides down under gravity (no floating).
- [ ] A car driven into a `LOOP` at ≥ 15.0 m/s completes the loop without falling through the segments.
- [ ] `isAirborne` and `airtime` are set correctly: `true` when all raycasts miss, `false` on landing, `airtime` resets on contact.
- [ ] Respawn triggers when `y < -5.0 m` and when stuck timer fires; car reappears at `START_FINISH` facing exit direction.
- [ ] `buildCollisionWorld(TrackData)` completes in < 5 ms for a fully-populated 16×16 grid (256 tiles).
- [ ] Physics tick runs at 60 Hz at < 4 ms wall-clock time on mid-range hardware (2020 MacBook Air equivalent).
- [ ] Zero imports from `src/lib/components/`, `src/lib/ui/`, `src/lib/scoring/`, or `src/lib/grid/` store.
- [ ] Unit tests cover: collision world construction, `InputVector` → velocity, airborne detection, respawn trigger.

### Regression Guardrails

- **Grid Manager immutability:** `buildCollisionWorld` receives a `TrackData` value and does not retain a reference to Grid Manager state. A subsequent `placeTile` call on the Grid Manager must not alter the live physics world.
- **Module boundary purity:** CI type-check (`pnpm typecheck`) must pass. Any import violation from Physics into Renderer/UI/Scoring is a build error.
- **Performance floor:** Physics tick must not exceed 4 ms per frame average on the reference hardware. If a loop tile causes raycasts to spike, use fewer segments.
- **Constants stability:** Renaming or removing any exported constant from `src/lib/physics/constants.ts` is a breaking change — Drive Mode and the scoring system reference these values for documentation and tests.

### Scenarios (Gherkin)

#### Scenario: Flat ground — throttle increases speed
**Given** a Rapier World built from a `TrackData` containing only `STRAIGHT` tiles
**And** the car is placed at the `START_FINISH` tile
**When** `InputVector { throttle: 1.0, steer: 0, brake: false }` is applied for 2 seconds (120 ticks)
**Then** `VehicleState.speed` is ≥ 15.0 m/s and ≤ 25.0 m/s

#### Scenario: Speed cap enforced
**Given** a car already at `MAX_FORWARD_SPEED` (25.0 m/s)
**When** `InputVector { throttle: 1.0, steer: 0, brake: false }` is applied for 10 more ticks
**Then** `VehicleState.speed` remains ≤ 25.1 m/s (0.1 tolerance for floating-point accumulation)

#### Scenario: Braking decelerates from top speed
**Given** a car at `VehicleState.speed = 25.0 m/s`
**When** `InputVector { throttle: 0, steer: 0, brake: true }` is applied
**Then** after 1 second (60 ticks), `VehicleState.speed` is ≤ 10.0 m/s

#### Scenario: Airborne detection on ramp launch
**Given** a `TrackData` with a `RAMP` tile at `(5, 5)` and `STRAIGHT` tiles leading up to it
**And** the car crosses the ramp at speed ≥ 20.0 m/s
**When** the car leaves the top of the ramp
**Then** `VehicleState.isAirborne` becomes `true`
**And** `VehicleState.velocityY` is > 0.0 m/s
**And** `VehicleState.airtime` increases each tick while airborne

#### Scenario: Landing resets airtime
**Given** `VehicleState.isAirborne` is `true` with `airtime = 1.5 s`
**When** the car lands and any wheel raycast makes contact
**Then** `VehicleState.isAirborne` becomes `false`
**And** `VehicleState.airtime` resets to `0.0`

#### Scenario: Fall-off respawn
**Given** the car drives off the edge of the track
**When** `VehicleState.position.y` drops below `-5.0`
**Then** the car is teleported to the `START_FINISH` tile world position within 1 tick
**And** all velocity components are zeroed

#### Scenario: Stuck respawn
**Given** the car is wedged against a wall with `speed < 0.5 m/s` for 3.0 continuous seconds
**When** the stuck timer fires
**Then** the car is respawned at `START_FINISH` as per fall-off behavior

#### Scenario: Loop completion at minimum speed
**Given** a `TrackData` with a `LOOP` tile and a long straight approach
**And** the car enters the loop at `speed = 15.0 m/s`
**When** the car traverses the full loop (enters bottom, traverses top, exits bottom)
**Then** the car exits the loop on the far side without clipping through any segment
**And** `isAirborne` does not become `true` while inside the loop

#### Scenario: Loop fails at low speed (toy behavior)
**Given** the car enters the loop at `speed < 8.0 m/s`
**When** the car stalls at the top of the loop
**Then** gravity pulls the car back down (it does not hover)
**And** the car slides back out the entry side without crashing the simulation

#### Scenario: Bridge elevation
**Given** a `TrackData` with a `BRIDGE` tile at `(3, 3)`
**When** collision world is built
**Then** the bridge collider centre Y is `BRIDGE_ELEVATION + 0.025` (= `0.825 m`)
**And** a car driving off a ground-level tile at `(2, 3)` does NOT automatically ascend to bridge height (ramp approach required)

#### Scenario: `buildCollisionWorld` performance
**Given** a fully-populated 16×16 `TrackData` (all 256 cells non-null, mixed tile types)
**When** `buildCollisionWorld(trackData)` is called
**Then** it completes in < 5 ms (measured via `performance.now()`)

#### Scenario: No cross-module imports
**Given** the compiled TypeScript output
**When** `pnpm typecheck` runs
**Then** no file under `src/lib/physics/` imports from `src/lib/components/`, `src/lib/ui/`, `src/lib/scoring/`, or the Grid Manager store (`src/lib/grid/store.svelte.ts`)

---

## Related / Future

These are out of scope for this spec but will require spec updates before implementation:

- **Drive Mode (Epic 5):** Keyboard → `InputVector` mapping, `DriveMode` state machine, chase camera, and HUD live in the Drive Mode spec (`specs/drive-mode/spec.md`).
- **Score Manager (Epic 7):** Stunt detection reads `VehicleState.airtime`, `VehicleState.angularVelocity`, and `VehicleState.speed`. The scoring spec will define event thresholds.
- **Ice / special tiles:** Future `FRICTION_SLIP` variation — add new tile type, not a physics constant override.
- **Underside bridge driving:** Requires a second collider at ground level and an arch clearance shape. Deferred to avoid increasing loop complexity in v1.
- **Multiplayer ghost physics:** Deterministic replay requires a seeded Rapier World and a fixed `InputVector` log. Deferred.
