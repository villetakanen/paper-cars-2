# Grid Manager Specification

**Document Status:** Draft
**Related Spec:** [track-format.spec.md](track-format.spec.md)

## Blueprint (Design)

### Context
The **Grid Manager** is the source of truth for the track layout during editing and gameplay. It manages a reactive 16x16 grid of tiles, enforces placement invariants, and provides an API for the UI (Track Editor) to modify the track.

Consistent with **VISION.md**, the Grid Manager ensures that building a track feels like playing with physical toy sets — pieces snap into place and rules are enforced immediately.

### Architecture

**New Module**: `src/lib/grid/`

The Grid Manager is a singleton reactive store built using Svelte 5 `$state`.

#### State Model
- **`grid`**: A 16x16 2D array of `(TrackTile | null)`.
- **`startPosition`**: (Computed) The `[x, z]` coordinates of the required `START_FINISH` tile.
- **`isValid`**: (Computed) Boolean indicating if the track meets minimum requirements (currently: contains exactly one `START_FINISH` tile).

#### Coordinate System
- **Origin (0,0)**: Top-left of the grid.
- **Axis X**: Column index (0–15).
- **Axis Z**: Row index (0–15).
- **Indexing**: `grid[z][x]` matches the row-by-row serialization order.

#### API Surface
- `placeTile(x, z, type, rotation)`: 
  - Overwrites any existing tile at `(x, z)`.
  - **Singleton Rule**: If `type` is `START_FINISH`, any existing `START_FINISH` tile elsewhere on the grid is automatically removed.
- `removeTile(x, z)`: Sets `grid[z][x]` to `null`.
- `rotateTile(x, z)`: 
  - Increments rotation by 90° clockwise (`0 -> 90 -> 180 -> 270 -> 0`).
  - Does nothing if the cell is empty.
- `clearGrid()`: Resets all cells to `null`.
- `loadTrack(data: TrackData)`:
  - Validates that the track contains exactly one `START_FINISH` tile. Throws an `Error` if validation fails — no state mutation occurs before validation completes.
  - On success, atomically replaces the current grid state with the provided track data.

### Invariants
1. **Fixed Dimensions**: The grid is always exactly 16x16. Operations outside these bounds must be silently ignored (no-op).
2. **Start Singularity**: A track MUST contain exactly zero or one `START_FINISH` tile at any point during editing, and exactly one for validation to pass.
3. **Immutability (Output)**: When exporting track data, the Grid Manager returns a deep copy or a frozen object to prevent external mutation of internal state.

### Anti-Patterns

- **Returning mutable internal state**: Never expose a direct reference to the internal `grid` array. All reads must return a deep copy or be consumed through `$derived` — callers must not be able to mutate grid state by holding a reference.
- **Importing from UI, Rendering, or Physics**: The Grid Manager is a pure logic module. It must not import from `src/lib/components/`, `src/lib/ui/`, `src/lib/physics/`, or `src/lib/scoring/`. Data flows out; nothing flows in from those layers.
- **Using `.svelte` component lifecycle hooks**: `onMount`, `onDestroy`, and other Svelte lifecycle functions are UI concerns. Only `$state` and `$derived` runes are permitted — no lifecycle coupling.
- **DOM or browser API dependencies**: No `document`, `window`, `localStorage`, or similar. The Grid Manager is environment-agnostic and must be unit-testable in a pure Node.js context (Vitest, no jsdom required).
- **Silent partial state on `loadTrack` failure**: Never mutate the grid before validation passes. A failed `loadTrack` call must leave the grid in its prior state, not in a half-loaded one.
- **Throwing on out-of-bounds placement/removal**: Boundary violations are user-facing actions (a tile dragged off the grid). They must silently no-op, not crash the editor.

---

## Contract (Quality)

### Definition of Done
- [ ] Reactive store implemented in `src/lib/grid/store.ts`.
- [ ] `placeTile` correctly handles the `START_FINISH` singularity (removing previous start tiles).
- [ ] `rotateTile` cycles through 0, 90, 180, 270 degrees.
- [ ] Grid dimensions are strictly enforced (16x16).
- [ ] `isValid` correctly reflects the presence of exactly one `START_FINISH` tile.
- [ ] Zero dependencies on physics, rendering, or UI modules (Svelte `$state` is permitted, but no `.svelte` components or DOM types).
- [ ] Unit tests cover all API methods and invariants.

### Regression Guardrails
- **Start Piece Integrity**: It should be impossible to have two `START_FINISH` tiles on the grid using the public API.
- **Boundary Safety**: Mutating coordinates `< 0` or `>= 16` must not throw index-out-of-bounds but should be handled gracefully (e.g., as a no-op).

### Scenarios (Gherkin)

#### Scenario: Placing a Start/Finish tile removes the old one
**Given** a grid with a `START_FINISH` tile at (2, 2)
**When** a `START_FINISH` tile is placed at (5, 5)
**Then** cell (5, 5) should contain the `START_FINISH` tile
**And** cell (2, 2) should be `null`

#### Scenario: Cycling rotation
**Given** a `STRAIGHT` tile at (0, 0) with `rotation: 270`
**When** `rotateTile(0, 0)` is called
**Then** the tile at (0, 0) should have `rotation: 0`

#### Scenario: Boundary Enforcement
**Given** a 16x16 grid
**When** attempting to `placeTile(16, 16, STRAIGHT, 0)`
**Then** the operation should be ignored
**And** the grid state should remain unchanged

#### Scenario: Validity State
**Given** an empty grid
**When** a `STRAIGHT` tile is placed
**Then** `isValid` should be `false`
**When** a `START_FINISH` tile is placed
**Then** `isValid` should be `true`

#### Scenario: Loading an invalid track
**Given** a `TrackData` object missing a `START_FINISH` tile
**When** `loadTrack` is called with this data
**Then** an error should be thrown
**And** the grid state should remain unchanged

#### Scenario: Clearing the grid
**Given** a grid with a `START_FINISH` tile and various other tiles
**When** `clearGrid()` is called
**Then** all cells should be `null`
**And** `isValid` should be `false`

#### Scenario: Out-of-bounds removeTile
**Given** a 16x16 grid
**When** attempting to `removeTile(-1, 5)`
**Then** the operation should be ignored
**And** the grid state should remain unchanged
