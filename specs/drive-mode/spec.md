# Drive Mode — First Playable

**Document Status:** Draft
**Related Specs:** [game-physics.spec.md](../game-physics.spec.md), [rendering.spec.md](../rendering.spec.md), [grid-manager.spec.md](../grid-manager.spec.md), [track-editor.spec.md](../track-editor.spec.md)

---

## Blueprint (Design)

### Context

Paper Cars 2 has a track builder (Grid Manager), a renderer (Threlte scene), and a physics engine (PhysicsController with Rapier.js). But there is no way to *play*. Drive Mode connects these into the first playable experience: the player presses a button, a car appears on the track, and they drive it with the keyboard.

This is the **"first playable" milestone** — the moment the project becomes a game instead of a diorama. Per VISION.md, "time-to-first-jump should be under 10 seconds from page load." Everything in this spec serves that goal.

Per the **fast over complete** heuristic, this spec covers the minimal viable driving experience: keyboard input, physics stepping, car rendering, chase camera, and a basic HUD. Advanced features (lap counting, ghost replay, touch/gamepad input) are out of scope.

### Architecture

**Modules involved:**

| Module | Role in Drive Mode |
|--------|-------------------|
| Physics Controller (`src/lib/physics/`) | **Already implemented.** Owns `PhysicsController` class, `VehicleState`, `InputVector`. Drive Mode instantiates it and feeds input. |
| Renderer (`src/lib/components/`) | Renders the car mesh using `VehicleState` position/rotation. Chase camera follows the car. |
| UI (`src/lib/ui/`) | Drive/Edit mode toggle button, HUD overlay (speedometer, timer), keyboard input capture. |
| Grid Manager (`src/lib/grid/`) | Provides `TrackData` snapshot to Physics via `gridStore.getTrackData()`. Read-only during Drive Mode. |

#### Data Flow

```
User clicks "Drive" button
  → UI sets gameMode store to "drive"
  → DriveController reads TrackData from gridStore.getTrackData()
  → PhysicsController.buildCollisionWorld(trackData)
  → Game loop starts (requestAnimationFrame)

Per frame:
  keyboard state → InputVector
  → PhysicsController.step(input, delta)
  → PhysicsController.vehicleState (reactive $state)
  → CarMesh.svelte reads position/rotation
  → ChaseCamera reads position for follow
  → HUD reads speed/airtime for display

User clicks "Edit" button or presses Escape:
  → PhysicsController.dispose()
  → gameMode store → "editor"
  → Orbit camera and editor UI restored
```

#### Game Mode Store

**New API surface:** `src/lib/stores/gameMode.svelte.ts`

A simple Svelte 5 rune store that tracks the current application mode. This is the coordination point between UI, Renderer, and Physics — each module reacts to the mode value.

```typescript
export type GameMode = "editor" | "drive";

class GameModeStore {
  current: GameMode = $state("editor");
}

export const gameModeStore = new GameModeStore();
```

The store is deliberately minimal — it holds a single value. Mode transitions are explicit: UI components set `gameModeStore.current`, and other modules react via Svelte's reactivity.

#### Drive Controller

**New API surface:** `src/lib/stores/driveController.svelte.ts`

A Svelte 5 rune module that orchestrates the Physics Controller lifecycle and game loop. It bridges the gap between the UI-level mode toggle and the Physics Controller's imperative API.

```typescript
class DriveController {
  private physics: PhysicsController | null = null;
  private animFrameId: number = 0;
  private lastTime: number = 0;

  /** True when physics is initialized and the game loop is running. */
  isRunning: boolean = $state(false);

  /** Current vehicle state, reactively forwarded from PhysicsController. */
  vehicleState: VehicleState = $state({ /* defaults */ });

  /** Elapsed drive time in seconds since entering drive mode. */
  elapsed: number = $state(0);

  async start(trackData: TrackData): Promise<void>;
  stop(): void;
}

export const driveController = new DriveController();
```

Responsibilities:
- Calls `RAPIER.init()` (idempotent) and `PhysicsController.buildCollisionWorld(trackData)` on `start()`
- Runs the game loop via `requestAnimationFrame`, calling `PhysicsController.step()` each frame
- Forwards `PhysicsController.vehicleState` to its own reactive `vehicleState` for consumption by Renderer and HUD
- Tracks elapsed drive time for the timer HUD
- Calls `PhysicsController.dispose()` and cancels the animation frame on `stop()`

#### Keyboard Input

**New API surface:** `src/lib/input/keyboard.svelte.ts`

Maps keyboard events to `InputVector`. Active only when `gameModeStore.current === "drive"`.

```typescript
class KeyboardInput {
  /** Current input vector, updated reactively from keydown/keyup events. */
  input: InputVector = $state({ throttle: 0, steer: 0, brake: false, reset: false });

  /** Attach keyboard listeners to window. Call once on component mount. */
  attach(): void;
  /** Remove keyboard listeners. Call on component destroy or mode switch. */
  detach(): void;
}

export const keyboardInput = new KeyboardInput();
```

Key bindings (non-configurable for v1):

| Action | Keys |
|--------|------|
| Throttle (forward) | `W` / `ArrowUp` |
| Reverse | `S` / `ArrowDown` |
| Steer left | `A` / `ArrowLeft` |
| Steer right | `D` / `ArrowRight` |
| Brake | `Space` |
| Reset/respawn | `R` |
| Exit to editor | `Escape` |

Throttle and steering are binary (0 or 1 / -1), not analog. The Physics Controller's `STEER_INTERPOLATION` smooths steering; the input layer does not need to ramp.

#### Car Rendering

**New API surface:** `src/lib/components/CarMesh.svelte`

A Threlte component that loads `VEHICLE_ASSET` ("/assets/vehicles/racer.glb") via `useGltf()` and positions it using `driveController.vehicleState`. Rendered only when `gameModeStore.current === "drive"`.

```svelte
<!-- Props: none — reads driveController.vehicleState directly -->
<T.Group
  position={[state.position.x, state.position.y, state.position.z]}
  quaternion={[state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w]}
>
  {#if gltf}
    <T is={gltf.scene.clone()} />
  {/if}
</T.Group>
```

The car model is a Kenney Toy Car Kit asset (`vehicle-racer.glb`) rendered as-is with embedded materials (bright, plastic). No paper/cardboard shaders.

#### Chase Camera

The existing `CameraRig.svelte` already accepts a `mode` prop with `"editor"` and `"drive"` branches. The `"drive"` branch currently renders a static camera. This spec replaces it with a smooth-follow chase camera.

Chase camera parameters (exported constants from `src/lib/components/constants.ts`):

| Constant | Value | Notes |
|----------|-------|-------|
| `CHASE_DISTANCE` | `5.0` | Distance behind the car in world units |
| `CHASE_HEIGHT` | `2.5` | Camera height above the car |
| `CHASE_LOOK_AHEAD` | `2.0` | How far ahead of the car the camera looks |
| `CHASE_SMOOTHING` | `0.05` | Lerp factor per frame (lower = smoother, laggier) |

The camera follows behind the car using the car's forward direction (derived from `VehicleState.rotation`). Position is lerped each frame for smooth tracking. The look target is offset ahead of the car along its forward vector.

#### HUD

**New API surface:** `src/lib/ui/DriveHud.svelte`

A Svelte component overlaying the 3D canvas during Drive Mode. Shows:

- **Speedometer**: `driveController.vehicleState.speed` converted to display units (km/h = speed × 3.6)
- **Timer**: `driveController.elapsed` formatted as `mm:ss.ms`
- **Airtime indicator**: visual cue when `isAirborne === true` (text "AIRBORNE!" or similar)

The HUD reads from `driveController` only. It does not import from Physics Controller directly — `driveController` is the intermediary.

#### Mode Toggle

**New API surface:** `src/lib/ui/ModeToggle.svelte`

A button (or pair of buttons) that switches between editor and drive modes. Visible in both modes.

- In editor mode: shows "Drive" button (disabled if `gridStore.isValid === false` — no START_FINISH tile)
- In drive mode: shows "Edit" button (or the user presses Escape)

Transition logic:
- **Editor → Drive**: calls `driveController.start(gridStore.getTrackData())`; sets `gameModeStore.current = "drive"`
- **Drive → Editor**: calls `driveController.stop()`; sets `gameModeStore.current = "editor"`

#### Integration with TrackScene

`TrackScene.svelte` needs to:
1. Conditionally render `CarMesh` when in drive mode
2. Pass the current `gameMode` to `CameraRig`
3. Continue rendering tile meshes in both modes (the track doesn't disappear when driving)

```svelte
<Canvas>
  <Environment />
  <CameraRig mode={gameModeStore.current} />

  {#each gridStore.grid as row, z}
    <!-- tile rendering unchanged -->
  {/each}

  {#if gameModeStore.current === "drive"}
    <CarMesh />
  {/if}
</Canvas>
```

#### File Layout (New Files)

```
src/lib/stores/gameMode.svelte.ts     — GameMode store
src/lib/stores/driveController.svelte.ts — DriveController (physics lifecycle + game loop)
src/lib/input/keyboard.svelte.ts      — Keyboard → InputVector mapping
src/lib/components/CarMesh.svelte     — Vehicle 3D mesh
src/lib/ui/DriveHud.svelte            — Speed, timer, airtime HUD
src/lib/ui/ModeToggle.svelte          — Editor ↔ Drive button
```

Modified files:
```
src/lib/components/CameraRig.svelte   — Chase camera logic in "drive" branch
src/lib/components/TrackScene.svelte  — Conditional CarMesh, mode-aware CameraRig
src/lib/components/constants.ts       — Chase camera constants
src/App.svelte                        — Mount ModeToggle, DriveHud, wire gameMode
```

### Anti-Patterns

- **Physics Controller reading keyboard events**: The Physics Controller is input-agnostic (game-physics.spec.md). Drive Mode owns the `keyboard → InputVector` mapping. Never add `addEventListener` inside `src/lib/physics/`.
- **Mutating Grid Manager during Drive Mode**: The track is frozen while driving. `driveController.start()` takes a `TrackData` snapshot; subsequent editor mutations don't affect the physics world. The UI should prevent tile placement while in drive mode.
- **Retaining a stale Rapier World**: The Rapier World must be created fresh on each `start()` and destroyed on `stop()`. Reusing a world across editor sessions causes ghost colliders from deleted tiles.
- **Rendering the car in editor mode**: `CarMesh` must not appear when `gameModeStore.current === "editor"`. The car is a drive-mode-only entity.
- **Importing PhysicsController in Renderer components**: Renderer components read `driveController.vehicleState` (the intermediary store), not `PhysicsController.vehicleState` directly. This keeps the Renderer module boundary clean — it imports from `src/lib/stores/`, not `src/lib/physics/`.
- **Analog input simulation for v1**: Do not add gamepad support, touch controls, or analog ramping in this epic. Binary keyboard input is sufficient. Analog input is a future polish item.
- **HUD importing from Physics or Grid**: The HUD reads from `driveController` only. No direct imports from `src/lib/physics/` or `src/lib/grid/`.
- **Blocking render on WASM init**: `RAPIER.init()` is async and may take 10-50ms on first call. The UI should not freeze during initialization. Show the editor while physics loads; disable the "Drive" button until `RAPIER.init()` resolves if necessary, or just accept the brief delay on first drive.

---

## Contract (Quality)

### Definition of Done

- [ ] `GameMode` store exists in `src/lib/stores/gameMode.svelte.ts` with `"editor"` and `"drive"` values.
- [ ] `DriveController` in `src/lib/stores/driveController.svelte.ts` manages PhysicsController lifecycle (init, loop, dispose).
- [ ] `KeyboardInput` in `src/lib/input/keyboard.svelte.ts` maps WASD/Arrow keys to `InputVector`.
- [ ] `CarMesh.svelte` loads `vehicle-racer.glb` and positions it from `VehicleState`.
- [ ] `CameraRig.svelte` "drive" mode implements smooth chase camera (not static placeholder).
- [ ] `DriveHud.svelte` shows speedometer (km/h), elapsed timer, and airborne indicator.
- [ ] `ModeToggle.svelte` switches between editor and drive modes; "Drive" disabled when `gridStore.isValid === false`.
- [ ] Pressing W/ArrowUp accelerates the car; pressing A/D or Left/Right steers.
- [ ] Pressing Escape or clicking "Edit" returns to editor mode; physics world is disposed.
- [ ] Car renders at correct position and rotation matching `VehicleState` (no visual-physics desync).
- [ ] Chase camera follows behind the car smoothly during turns and speed changes.
- [ ] HUD speedometer updates in real-time; timer counts up from 0.
- [ ] Entering drive mode with no START_FINISH tile is prevented (button disabled) or spawns at grid centre as fallback.
- [ ] Stable 60fps during driving on a full 16×16 grid on mid-range hardware.
- [ ] Zero imports from `src/lib/physics/` in `src/lib/components/` — Renderer reads from `driveController` in `src/lib/stores/`.
- [ ] Zero imports from `src/lib/physics/` or `src/lib/grid/` in `src/lib/ui/` — UI reads from stores only.
- [ ] Unit tests for: `KeyboardInput` → `InputVector` mapping, `GameMode` transitions, `DriveController` start/stop lifecycle.
- [ ] E2E test: page loads → enter drive mode → car moves → exit drive mode → editor restored.

### Regression Guardrails

- **Grid Manager immutability during drive**: `gridStore.placeTile()` calls during drive mode must not affect the active physics world. The world is built from a snapshot.
- **Module boundary purity**: No file under `src/lib/components/` imports from `src/lib/physics/`. No file under `src/lib/ui/` imports from `src/lib/physics/` or `src/lib/grid/store.svelte.ts`.
- **Physics Controller input-agnosticism**: No file under `src/lib/physics/` imports from `src/lib/input/`, `src/lib/ui/`, `src/lib/stores/`, or references `window`, `document`, or `KeyboardEvent`.
- **Editor mode stability**: Switching back to editor mode must restore full editor functionality — orbit camera, tile placement, grid reactivity. No leftover drive mode artifacts.
- **Performance floor**: Game loop (physics step + render) must not exceed 16.67ms per frame on reference hardware (2020 MacBook Air).
- **Asset rendering rule**: The car model (`vehicle-racer.glb`) is rendered with its embedded Kenney materials. No custom shaders on the vehicle.

### Scenarios (Gherkin)

#### Scenario: Enter Drive Mode from Editor
**Given** the game is in editor mode
**And** the grid contains a `START_FINISH` tile at `(4, 4)` with rotation `0`
**When** the user clicks the "Drive" button
**Then** `gameModeStore.current` becomes `"drive"`
**And** a car mesh appears at world position `(4, CHASSIS_SPAWN_OFFSET_Y, 4)`
**And** the camera switches from orbit controls to chase camera
**And** the HUD (speedometer, timer) becomes visible

#### Scenario: Keyboard Input — Forward Throttle
**Given** the game is in drive mode
**When** the user presses and holds the `W` key
**Then** `keyboardInput.input.throttle` is `1.0`
**And** the car accelerates forward
**When** the user releases the `W` key
**Then** `keyboardInput.input.throttle` is `0.0`

#### Scenario: Keyboard Input — Steering
**Given** the game is in drive mode
**When** the user presses `A`
**Then** `keyboardInput.input.steer` is `-1.0` (left)
**When** the user presses `D`
**Then** `keyboardInput.input.steer` is `1.0` (right)
**When** both `A` and `D` are pressed simultaneously
**Then** `keyboardInput.input.steer` is `0.0` (cancel out)

#### Scenario: Keyboard Input — Brake and Reset
**Given** the game is in drive mode
**When** the user presses `Space`
**Then** `keyboardInput.input.brake` is `true`
**When** the user presses `R`
**Then** `keyboardInput.input.reset` is `true`
**And** the car respawns at the START_FINISH tile

#### Scenario: Chase Camera Follows Car
**Given** the game is in drive mode
**And** the car is moving forward
**When** the car turns left
**Then** the camera smoothly repositions behind the car's new heading
**And** the camera maintains `CHASE_DISTANCE` (5.0 units) behind the car
**And** the camera maintains `CHASE_HEIGHT` (2.5 units) above the car

#### Scenario: HUD Displays Speed and Time
**Given** the game is in drive mode
**And** the car is moving at `speed = 10.0 m/s`
**When** the HUD renders
**Then** the speedometer shows `36 km/h` (10.0 × 3.6)
**And** the timer shows elapsed time since entering drive mode
**When** `VehicleState.isAirborne` becomes `true`
**Then** an airborne indicator becomes visible

#### Scenario: Exit Drive Mode via Escape
**Given** the game is in drive mode
**When** the user presses `Escape`
**Then** `gameModeStore.current` becomes `"editor"`
**And** the physics world is disposed (no Rapier memory leak)
**And** the car mesh disappears
**And** the camera returns to orbit controls
**And** the HUD disappears
**And** editor functionality is fully restored

#### Scenario: Exit Drive Mode via Button
**Given** the game is in drive mode
**When** the user clicks the "Edit" button
**Then** the same transition as the Escape scenario occurs

#### Scenario: Drive Button Disabled Without START_FINISH
**Given** the game is in editor mode
**And** the grid has no `START_FINISH` tile (`gridStore.isValid === false`)
**When** the user looks at the mode toggle
**Then** the "Drive" button is disabled / not clickable

#### Scenario: Car Mesh Matches Physics State
**Given** the game is in drive mode
**And** `VehicleState.position` is `{ x: 5, y: 0.27, z: 8 }`
**And** `VehicleState.rotation` is a quaternion representing 45° Y rotation
**When** the frame renders
**Then** the `CarMesh` Three.js group position is `[5, 0.27, 8]`
**And** the group quaternion matches the VehicleState rotation

#### Scenario: Re-entering Drive Mode After Edit
**Given** the user was in drive mode, then returned to editor mode
**And** the user modifies the track (adds a new tile)
**When** the user enters drive mode again
**Then** a fresh Rapier World is built from the updated `TrackData`
**And** the new tile has collision geometry
**And** the car spawns at the (possibly moved) START_FINISH tile

#### Scenario: Drive Mode Performance
**Given** a full 16×16 grid with mixed tile types
**When** the user enters drive mode and drives at full speed
**Then** the frame rate remains at or above 60fps
**And** the physics tick completes in < 4ms per step

#### Scenario: Simultaneous Opposing Keys Cancel
**Given** the game is in drive mode
**When** the user presses both `W` and `S` simultaneously
**Then** `keyboardInput.input.throttle` is `0.0` (cancel out)

---

## Related / Future

- **Scoring System (Epic 7)**: Will subscribe to `driveController.vehicleState` for stunt detection (airtime, speed, angular velocity). Score HUD extends `DriveHud`.
- **Touch / Gamepad Input (Epic 9)**: Alternative input sources mapping to the same `InputVector` interface. The keyboard module's pattern (`attach`/`detach`) supports this by design.
- **Lap Counting**: Detecting when the car crosses START_FINISH to increment a lap counter. Requires a trigger zone in Physics — deferred.
- **Instant Replay / Ghost (future)**: Recording `InputVector` per tick for deterministic replay. Requires fixed timestep (already 60 Hz) and serialized input log.
- **Track Editor UI (Epic 6)**: The mode toggle button implemented here is minimal. Epic 6 builds the full editor chrome around it.
