# Drive Mode — First Playable

## Blueprint (Design)

### Context
The "Build" phase (Grid Manager) and "Visual" phase (Renderer) are established. However, without a vehicle and driving mechanics, the project is a static diorama rather than a game. This feature introduces the "Drive" part of the core loop: moving from a static track to an interactive, physics-driven experience. It fulfills the primary goal of providing immediate, fun, and physics-defying gameplay.

### Architecture
- **Modules Involved**:
    - **Physics Controller (`src/lib/physics/`)**: The primary driver. Will implement the `RaycastVehicle` logic using Rapier.js, managing vehicle state (velocity, angular velocity, position) and collision geometry generation from the `TrackGrid`.
    - **3D Renderer (`src/lib/components/`)**: Will implement the "Chase Camera" logic and map the vehicle's physics state to visual mesh transformations.
    - **UI Layer (`src/lib/ui/`)**: Will implement the "Drive Mode" state transition and a basic HUD (Speedometer, Timer).
    - **Grid Manager (`src/lib/grid/`)**: Provides the `TrackGrid` used to generate collision meshes.
- **Data Flow**:
    - **Input**: User input (WASD/Arrows) $\rightarrow$ Physics Controller.
    - **Simulation**: Physics Controller $\rightarrow$ updates vehicle state (position, rotation, velocity).
    - **Visuals**: Physics Controller state $\rightarrow$ Renderer (updates car mesh and camera position).
    - **UI**: Physics Controller state $\rightarrow$ UI (updates HUD).
- **New API Surfaces**:
    - `VehicleState`: A new reactive state (likely a Svelte store or rune) exported by the Physics Controller to be consumed by the Renderer and UI.
    - `DriveMode`: A new state in the global game mode store.

### Anti-Patterns
- **Physics-Renderer Coupling**: The Renderer must NOT drive the physics. The Physics Controller is the source of truth for position/rotation. The Renderer only reads these values to update meshes.
- **Direct DOM Manipulation**: The Physics Controller must remain pure logic/physics; it should not touch the DOM or Threlte components directly.
- **Over-Simulation**: Avoid complex suspension/engine models that compromise the "fun over correctness" principle. The goal is a snappy, arcade-like feel.
- **Mixing Editor and Drive Logic**: The physics simulation should only be active when in `DriveMode`. It must not interfere with the `GridManager` or `EditorMode` state.

## Contract (Quality)

### Physics Constants (Reference)
- **Gravity**: $-9.81 \, \text{m/s}^2$
- **Max Forward Velocity**: $25.0 \, \text{m/s}$
- **Max Reverse Velocity**: $-10.0 \, \text{m/s}$
- **Acceleration (Forward)**: $15.0 \, \text{m/s}^2$
- **Acceleration (Reverse)**: $-10.0 \, \text{m/s}^2$
- **Turn Rate (Angular Velocity)**: $1.5 \, \text{rad/s}$
- **Brake Force**: $20.0 \, \text{m/s}^2$
- **Camera Follow Distance**: $5.0 \, \text{units}$
- **Camera Smoothing (Lerp Factor)**: $0.1$
- **Camera Look-ahead**: $1.5 \, \text{units}$

### Definition of Done
- [ ] **Vehicle Movement**: The car can move forward, backward, and turn using keyboard input.
- [ ] **Collision**: The car interacts with the track geometry (ramps, curves) and stays on the track.
- [ ] **Chase Camera**: The camera smoothly follows the vehicle during movement.
- [ ] **Mode Transition**: The game can transition from `EditorMode` to `DriveMode` and back.
- [ ] **Testable**: A unit test verifies that input changes the vehicle's velocity.
- [ ] **Testable**: An E2E test verifies the car can move from point A to point B on a straight track.

### Regression Guardrails
- **Grid Integrity**: Driving must not mutate the `TrackGrid` or any data in the `GridManager`.
- **Performance**: The physics simulation must run at a stable frequency (60Hz) and the total frame time (Physics + Render) must remain below $16.67\text{ms}$.
- **Zero-State Stability**: The game must not crash if the `TrackGrid` is empty or invalid when entering `DriveMode`.

### Scenarios (Gherkin)

**Scenario: Basic Movement (Happy Path)**
- **Given** the game is in `DriveMode` with a valid `TrackGrid`
- **When** the user presses the "Forward" key (W or Up Arrow)
- **Then** the vehicle's forward velocity increases towards $25.0 \, \text{m/s}$
- **And** the vehicle's position in the 3D scene changes

**Scenario: Collision with Ramp (Boundary Condition)**
- **Given** the game is in `DriveMode`
- **And** the track contains a `RAMP` tile
- **When** the vehicle drives over the ramp
- **Then** the vehicle's vertical velocity (Y-axis) increases
- **And** the vehicle's position changes according to the ramp's geometry

**Scenario: Transition to Editor (Edge Case)**
- **Given** the game is in `DriveMode`
- **When** the user triggers a transition back to `EditorMode`
- **Then** the physics simulation is paused/stopped
- **And** the user can once again interact with the `GridManager` to edit the track

**Scenario: Missing Start Point (Edge Case)**
- **Given** the game is in `DriveMode`
- **And** the `TrackGrid` contains no `START_FINISH` tile
- **When** the game initializes the vehicle
- **Then** the vehicle spawns at the first valid non-empty tile (0,0) or the center of the grid
- **And** the game does not crash
