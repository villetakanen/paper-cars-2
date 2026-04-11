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

Assets are loaded via Threlte's `useGltf()` hook from the `@threlte/extras` package. Models are sourced from Kenney.nl CC0 kits and placed in `static/assets/tiles/`.

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
export const TILE_SIZE = 1.0;
```

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

- [ ] `TrackScene.svelte` renders a Threlte `<Canvas>` and reads `gridStore.grid` reactively.
- [ ] `TileMesh.svelte` renders the correct `.glb` model for each `TileType` at the correct grid position and rotation.
- [ ] Asset manifest (`assets.ts`) maps all six `TileType` values to `.glb` paths.
- [ ] `TILE_SIZE` constant is exported from `constants.ts` for cross-module use.
- [ ] `Environment.svelte` renders a ground plane, directional light, and ambient light.
- [ ] `CameraRig.svelte` provides orbit controls that work in editor mode.
- [ ] Placing/removing tiles in Grid Manager reactively updates the 3D scene (no page reload).
- [ ] Stable 60fps with a full 16x16 grid on a mid-range laptop (2020 MacBook Air equivalent).
- [ ] Total asset payload for all tile models < 2MB (gzipped).
- [ ] Zero imports from `src/lib/physics/`, `src/lib/scoring/`, or `src/lib/ui/`.
- [ ] Unit tests for asset manifest mapping (all TileType values covered).
- [ ] E2E test: page loads, canvas renders, at least one tile is visible.

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
**Then** the camera should orbit around the center of the grid
**And** the camera should support zoom (scroll wheel)

#### Scenario: Environment visual identity
**Given** a rendered scene
**When** inspecting the ground plane material
**Then** it should use a paper/cardboard-like texture or material (not photorealistic, not plain color)
**And** the directional light should cast from above-and-to-the-side (desk lamp angle)

---

## Related / Future

- **Chase camera** (Epic 5): `CameraRig.svelte` will gain a `"drive"` mode that follows the car. Placeholder only in this spec.
- **Car rendering** (Epic 5): A static car model at the start position. Animated driving is Epic 5.
- **Score visual feedback** (Epic 7): Renderer may subscribe to score events for particle effects or screen flash. Not in this spec.
- **Paper buildings / scenery** (Epic 9: Polish): Extended environment with folded paper decorations. This spec covers only the ground plane and lighting.
