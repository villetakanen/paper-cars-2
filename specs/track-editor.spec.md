# Track Editor UI

## Blueprint (Design)

### Context
The Track Editor is the core creative interface of Paper Cars 2. Per **VISION.md**, "building tracks is at least as fun as driving them." The UI must be intuitive, fast, and feel like a tactile toy set. 

Consistent with the **Fast over Complete** heuristic, this spec covers the minimal UI needed to place, rotate, and remove the 6 base tile types, plus the "Drive" and "Share" functions.

### Architecture
- **Module**: `src/lib/ui/editor/`
- **Data Flow**:
    - **UI to Grid Manager**: Tile selection and placement actions trigger `gridStore.placeTile`, `gridStore.removeTile`, etc.
    - **Grid Manager to UI**: UI reacts to `gridStore.isValid` (to enable/disable Drive mode).
    - **UI to App State**: Toggling between `editor` and `drive` modes.
- **Svelte Stores**:
    - **`editorStore` (New API Surface)**: A dedicated store for editor-specific UI state (current selected tool, active tile type, hover coordinates).
- **Integration Points**:
    - **Renderer**: The Renderer will read `editorStore.hoverPos` and `editorStore.activeTile` to display a "ghost" tile and a grid overlay.
    - **URL Serializer**: The "Share" button calls the serializer to generate a URL.

### Anti-Patterns
- **Directly Mutating Grid from UI Components**: All grid changes must go through `gridStore` methods to ensure invariants (like the Start singularity) are maintained.
- **Renderer-owned Editor State**: The 3D scene should not know which "tool" is selected. It should only read the `editorStore` reactive state.
- **Complex Modal Logic**: Avoid nested menus. Use a flat palette for "Instant Gratification".
- **External Asset Dependencies**: All icons/UI elements must be self-contained (SVG) or use the project's Svelte components.

## Contract (Quality)

### Definition of Done
- [ ] Tile Palette UI allows selecting one of the 6 `TileType` values.
- [ ] Toolbar includes "Clear", "Drive", and "Share" buttons.
- [ ] "Drive" button is disabled/hidden if `gridStore.isValid` is false.
- [ ] Left-click on the grid places the selected tile.
- [ ] Right-click (or Erase tool) removes a tile.
- [ ] 'R' key (or Rotate tool) rotates the tile under the cursor or the ghost tile.
- [ ] "Share" button copies the track URL to the clipboard.
- [ ] Mobile-responsive layout (palette shifts to bottom or becomes a drawer).
- [ ] E2E tests for the "Place → Rotate → Clear" user flow.

### Regression Guardrails
- **Editor Mode only**: Editor UI components must not be visible or active while in `drive` mode.
- **Contract Integrity**: UI must exclusively use `gridStore` methods for mutation; it must never manipulate the `_grid` array directly.

### Scenarios (Gherkin)

#### Scenario: Selecting a tile from the palette
**Given** the editor is open
**When** the user clicks the `RAMP` icon in the palette
**Then** the `RAMP` tile should be marked as active in the UI
**And** a ghost `RAMP` should appear in the 3D scene under the cursor

#### Scenario: Placing a tile
**Given** the `STRAIGHT` tile is selected
**When** the user clicks grid cell (4, 4)
**Then** `gridStore.placeTile(4, 4, 'STRAIGHT', 0)` is called
**And** the 3D scene updates to show the tile

#### Scenario: Rotating the selection
**Given** the `CURVE` tile is selected
**When** the user presses the 'R' key
**Then** the ghost tile rotation should cycle (0 -> 90 -> 180 -> 270)
**And** subsequent placement uses the new rotation

#### Scenario: Sharing a track
**Given** a valid track with a `START_FINISH` tile
**When** the user clicks "Share"
**Then** the serialized track URL should be copied to the clipboard
**And** a "Success" toast/notification should appear

#### Scenario: Drive mode locking
**Given** a grid with no `START_FINISH` tile
**When** the editor UI renders
**Then** the "Drive" button should be disabled
**And** a tooltip should explain that a Start tile is required
