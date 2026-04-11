# 3D Rendering

**Document Status:** Draft
**Related Specs:** [grid-manager.spec.md](grid-manager.spec.md), [track-format.spec.md](track-format.spec.md)

## Blueprint (Design)

### Context

The Renderer is the first visual layer of Paper Cars 2 — it turns abstract grid data into a 3D scene the player can see and interact with. Without it, the game is invisible.

Per **VISION.md**, the visual identity is "toy cars in a paper town": Kenney.nl toy assets are rendered as-is (bright, plastic, glossy) while the *environment* uses paper/cardboard materials. This contrast — shiny toys on a handmade diorama — is the game's look. The Renderer must not try to be photorealistic; it should look like a desk with toy cars and folded paper buildings.

Per the **fast over complete** heuristic, this spec covers the minimal rendering pipeline needed to see a track. Advanced effects (particle systems, post-processing, dynamic shadows) are out of scope.

### Architecture

**Module:** `src/lib/components/`

The Renderer is a set of Threlte/Svelte components that declaratively map Grid Manager state to Three.js scene objects. It owns no state — it reads from the Grid Manager's reactive store and renders what it finds.

#### Data Flow

```
gridStore.grid (reactive read)
  → TrackScene.svelte (iterates grid cells)
    → TileMesh.svelte (per-cell: loads correct .glb, applies position/rotation)
    → Environment.svelte (ground plane, skybox, lighting)
    → CameraRig.svelte (orbit camera for editor, chase camera placeholder)
```

#### Component Tree

- **`TrackScene.svelte`** — Root scene component. Wraps Threlte `<Canvas>` and contains all 3D children. Reads `gridStore.grid` reactively.
- **`TileMesh.svelte`** — Renders a single track tile. Props: `tileType: TileType`, `rotation: Rotation`, `gridX: number`, `gridZ: number`. Loads the corresponding `.glb` model, positions it at grid coordinates, and applies rotation.
- **`Environment.svelte`** — Static scene furniture: ground plane with cardboard texture, ambient + directional lighting (desk lamp feel), simple sky/backdrop.
- **`CameraRig.svelte`** — Orbit controls for editor mode. Accepts a `mode` prop (`"editor" | "drive"`). Drive mode chase camera is a placeholder (implemented in Epic 5).

#### Asset Manifest

**New API surface:** `src/lib/components/assets.ts`

A mapping from `TileType` to `.glb` model path. This is the contract between the Grid Manager's tile types and the 3D models.

```typescript
const TILE_ASSETS: Record<TileType, string> = {
  STRAIGHT: "/assets/tiles/straight.glb",
  CURVE: "/assets/tiles/curve.glb",
  RAMP: "/assets/tiles/ramp.glb",
  LOOP: "/assets/tiles/loop.glb",
  BRIDGE: "/assets/tiles/bridge.glb",
  START_FINISH: "/assets/tiles/start-finish.glb",
};
```

Assets are loaded via Threlte's `useGltf()` hook from the `@threlte/extras` package. Models are Kenney.nl CC0 assets placed in `static/assets/tiles/`:

| File | Source kit | Original filename |
|------|-----------|-------------------|
| `straight.glb` | Kenney Toy Car Kit | `track-road-narrow-straight.glb` |
| `curve.glb` | Kenney Toy Car Kit | `track-road-narrow-corner-small.glb` |
| `ramp.glb` | Kenney Toy Car Kit | `track-road-narrow-straight-hill-beginning.glb` |
| `loop.glb` | Kenney Toy Car Kit | `track-road-narrow-looping.glb` |
| `bridge.glb` | Kenney Racing Kit | `roadStraightBridge.glb` |
| `start-finish.glb` | Kenney Toy Car Kit | `gate-finish.glb` |

The player vehicle model lives at `static/assets/vehicles/racer.glb` (Kenney Toy Car Kit: `vehicle-racer.glb`) and is referenced via `VEHICLE_ASSET` exported from `assets.ts`. Drive Mode (Epic 5) consumes it.

> ~~**Outstanding:** As of Epic 3 implementation, the `static/assets/tiles/` directory and the six `.glb` files do not yet exist.~~ *(Resolved — all assets placed.)* The renderer code is complete; the actual Kenney.nl model files must be downloaded and placed in `static/assets/tiles/` before the scene renders 3D tiles. Until then, the canvas renders only the environment (ground plane, lighting) with no tile geometry. Acquiring the assets is a required step to close Epic 3.

#### `useGltf` Capture-at-Mount Pattern

Threlte's `useGltf()` call-site must receive a static string URL — it cannot be passed a reactive value and re-called when the value changes. `TileMesh.svelte` works around this by capturing the `tileType` prop once at mount:

```svelte
const gltf = useGltf(TILE_ASSETS[tileType]);  // captured at mount
```

When a tile's type changes (e.g. STRAIGHT → CURVE), the parent `TrackScene.svelte` destroys and recreates the `TileMesh` component using a `{#key cell.type}` block. This is the intended reactivity pattern. The Svelte compiler emits a `state_referenced_locally` warning on this line; the warning is expected and safe to ignore because the keyed-recreation strategy guarantees a fresh component for each tile type.

#### Grid-to-World Coordinate Mapping

Grid coordinates (integer `x`, `z` in range 0–15) map to world positions:

- **World X** = `gridX * TILE_SIZE`
- **World Z** = `gridZ * TILE_SIZE`
- **World Y** = `0` (ground level; elevated tiles like BRIDGE handle their own Y offset internally via the model)
- **`TILE_SIZE`** = `1.0` (world unit per grid cell — Kenney tile models are assumed to be 1×1 unit footprint)
- **Rotation** = tile `rotation` value in degrees, applied as Y-axis rotation

This is an exported constant so Physics can use the same mapping for collision geometry:

**New API surface:** `src/lib/components/constants.ts`

```typescript
export const TILE_SIZE = 1.0;  // world units per grid cell; shared with Physics
export const GRID_SIZE = 16;   // grid is always 16×16; shared by CameraRig and Environment
```

`GRID_SIZE` is consumed by `CameraRig.svelte` (to centre the camera on the grid) and `Environment.svelte` (to size the ground plane). It is not exported for Physics — Physics derives grid dimensions from `TrackData.grid.length` at runtime, not this constant.

#### Integration Points

- **Grid Manager** (read-only): `gridStore.grid`, `gridStore.isValid`, `gridStore.startPosition` — consumed reactively.
- **Track Types**: `TileType`, `Rotation`, `TrackTile` from `src/lib/types/track.ts`.
- **Physics Controller** (future): will share `TILE_SIZE` constant for collision geometry alignment.

### Anti-Patterns

- **Mutating Grid Manager state**: The Renderer MUST NOT import `placeTile`, `removeTile`, or any Grid Manager mutation method. It reads `gridStore.grid` only. State flows one way: Grid Manager → Renderer.
- **Owning game state in components**: No `$state` for game-relevant data (track layout, scores, physics). Components may use `$state` for purely visual concerns (animation progress, hover highlights) but never for data that other modules need.
- **Importing from Physics or Scoring**: Renderer reads Grid Manager data to draw tiles. It does not read physics state (that's Epic 5's chase camera) or scoring state (that's the UI HUD). Keep the dependency arrow narrow.
- **Custom shaders on toy assets**: Kenney.nl models must render as-is with their embedded materials (bright, plastic). Paper/cardboard materials apply to environment objects only (ground, sky, buildings). Mixing them destroys the visual contrast.
- **Blocking asset loads**: `.glb` files must load asynchronously. Never block the render loop or initial paint waiting for a model. Use Threlte's built-in suspense/loading patterns. Show an empty grid cell until the model arrives.
- **Hardcoded grid iteration**: Do not manually manage a list of "what's on screen." Derive the rendered tiles from `gridStore.grid` reactively. When a tile changes, Svelte's reactivity handles the update — no manual scene graph management.
- **Non-Kenney assets**: Per CLAUDE.md, all 3D assets must be from Kenney.nl CC0 kits. No other sources.

---

## Contract (Quality)

### Definition of Done

- [x] `TrackScene.svelte` renders a Threlte `<Canvas>` and reads `gridStore.grid` reactively.
- [x] `TileMesh.svelte` renders the correct `.glb` model for each `TileType` at the correct grid position and rotation (component code complete; blocked on assets).
- [x] Asset manifest (`assets.ts`) maps all six `TileType` values to `.glb` paths.
- [x] `TILE_SIZE` and `GRID_SIZE` constants exported from `constants.ts` for cross-module use.
- [x] `Environment.svelte` renders a ground plane with paper/cardboard material (`#c4a882`, `roughness: 1`), warm directional light, and ambient fill.
- [x] `CameraRig.svelte` provides orbit controls that work in editor mode.
- [x] Placing/removing tiles in Grid Manager reactively updates the 3D scene (no page reload). (`{#key cell.type}` pattern ensures component recreation on tile-type change.)
- [x] **All six `.glb` model files present in `static/assets/tiles/`** — sourced from Kenney Toy Car Kit (CC0) and Kenney Racing Kit (CC0). See asset table above.
- [ ] Stable 60fps with a full 16x16 grid on a mid-range laptop (2020 MacBook Air equivalent). *(Verify in browser.)*
- [ ] Total asset payload for all tile models < 2MB (gzipped). *(Current total: ~162 KB uncompressed — well under budget.)*
- [x] Zero imports from `src/lib/physics/`, `src/lib/scoring/`, or `src/lib/ui/`.
- [x] Unit tests for asset manifest mapping (all TileType values covered) — `tests/unit/rendering-assets.test.ts`.
- [x] Unit test for `GRID_SIZE = 16` — `tests/unit/rendering-assets.test.ts`.
- [x] E2E test: page loads, canvas renders, no console errors. *(Covered by `tests/e2e/scene-renders.test.ts`.)*

### Regression Guardrails

- **Read-only contract**: Renderer components must never gain an import path to Grid Manager mutation methods (`placeTile`, `removeTile`, `rotateTile`, `clearGrid`, `loadTrack`).
- **Asset source**: Only Kenney.nl CC0 assets. No asset additions from other sources without discussion.
- **Performance floor**: Rendering a full 256-tile grid must not drop below 30fps on any target hardware. 60fps is the target; 30fps is the hard floor.
- **Bundle budget**: Total bundle size including assets must stay under 5MB (from ARCHITECTURE.md performance targets).
- **No state ownership**: Renderer components must not introduce `$state` fields that are consumed by other modules.

### Scenarios (Gherkin)

#### Scenario: Rendering a single tile
**Given** a grid with a `STRAIGHT` tile at (3, 5) with rotation 90
**When** the `TrackScene` component renders
**Then** a 3D mesh should appear at world position (3 * TILE_SIZE, 0, 5 * TILE_SIZE)
**And** the mesh should be rotated 90 degrees around the Y axis

#### Scenario: Reactive tile update
**Given** a rendered scene with a `STRAIGHT` tile at (0, 0)
**When** the tile at (0, 0) is replaced with a `CURVE` tile via `gridStore.placeTile`
**Then** the scene should update to show a `CURVE` model at (0, 0)
**And** no page reload should occur

#### Scenario: Empty grid renders clean scene
**Given** an empty 16x16 grid (all null)
**When** the `TrackScene` component renders
**Then** the environment (ground plane, lighting) should be visible
**And** no tile meshes should be present in the scene

#### Scenario: Full grid performance
**Given** a 16x16 grid with all 256 cells filled with tiles
**When** the scene renders and the camera orbits
**Then** the frame rate should stay at or above 60fps on a mid-range laptop

#### Scenario: Asset loading gracefully handles missing model
**Given** a tile type that references a `.glb` file that has not loaded yet
**When** the `TileMesh` component renders
**Then** no error should be thrown
**And** the cell should appear empty until the asset loads

#### Scenario: Camera orbit in editor mode
**Given** the camera rig in `"editor"` mode
**When** the user drags to rotate the view
**Then** the camera should orbit around the center of the grid `(GRID_SIZE * TILE_SIZE / 2, 0, GRID_SIZE * TILE_SIZE / 2)` = `(8, 0, 8)`
**And** the camera should support zoom (scroll wheel)

#### Scenario: Environment visual identity
**Given** a rendered scene
**When** inspecting the ground plane material
**Then** it should use colour `#c4a882` with `roughness: 1.0` and `metalness: 0` (non-photorealistic cardboard look)
**And** the directional light colour should be warm white (`#fff8f0`) positioned above-and-to-the-side (desk lamp angle)
**And** the ambient fill should be warm (`#ffeedd`) at intensity ≤ 0.5

#### Scenario: Tile mesh visible after assets loaded
**Given** the six `.glb` files exist in `static/assets/tiles/`
**And** a grid with a `STRAIGHT` tile at `(0, 0)`
**When** the `TrackScene` component renders and assets finish loading
**Then** a mesh node should be present in the Three.js scene at world position `(0, 0, 0)`
**And** the mesh should have geometry (vertex count > 0)

---

## Outstanding Work (before Epic 3 closes)

1. ~~**Download Kenney.nl assets**~~ — *(Resolved. All six `.glb` files placed in `static/assets/tiles/` from Kenney Toy Car Kit and Racing Kit.)*
2. **Verify 60fps in browser** — Run `pnpm dev`, place a full 16×16 grid, confirm no frame drops. Not automatable; requires manual check.

## Related / Future

- **Chase camera** (Epic 5): `CameraRig.svelte` will gain a `"drive"` mode that follows the car. Placeholder (`mode="drive"` renders a static camera at grid centre) is already wired; implementation is Epic 5's responsibility.
- **Car rendering** (Epic 5): A static car model at the START_FINISH position. Animated driving is Epic 5.
- **Score visual feedback** (Epic 7): Renderer may subscribe to score events for particle effects or screen flash. Not in this spec.
- **Paper buildings / scenery** (Epic 9: Polish): Extended environment with folded paper decorations. This spec covers only the ground plane and lighting.
