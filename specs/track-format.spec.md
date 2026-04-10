# Track Format Specification

**Document Status:** Draft
**Related Spec:** N/A (Foundational)

> [!CAUTION]
> **CRITICAL CONTRACT**: The track data format is the single most sensitive architectural surface. Changes here constitute a **BREAKING CHANGE** across the Grid Manager, Physics Controller, Renderer, and URL Serializer.

## Blueprint (Design)

### Context
Paper Cars 2 requires a lightweight, serializable, and immutable representation of a track. This feature provides the "Contract" between the track editor (writer) and the physics/rendering engines (readers). Sharing tracks via URL is a first-class feature, requiring the format to be compact enough to fit within browser URL length limits (typically <2,000 characters).

Consistent with **VISION.md**, we prioritize **Fast over Complete**: we start with 6 essential tile types that enable the core "Build → Drive" loop.

### Architecture

**New API surface**: `TrackData`, `TrackTile`, and grid encoding functions.

#### Grid
- **Fixed 16×16 2D grid**. Every track is exactly 256 cells.
- **Axes**: `x` (East/West, 0–15) and `z` (North/South, 0–15). No y-axis in coordinates.
- **Height** is implicit per tile type, not a coordinate. Bridge tiles render and collide at an elevated fixed height; all other tiles sit at ground level. This mirrors Stunts (1990), which used the same model: a flat grid with bridge pieces that cars could drive over or under.
- **One tile per cell.** The grid structure makes duplicate positions impossible.
- Each cell is either **empty** or contains one `TrackTile`.

#### Tile Types
| Type | Height | Description |
|---|---|---|
| `STRAIGHT` | Ground | Flat road segment |
| `CURVE` | Ground | 90-degree turn |
| `RAMP` | Ground | Inclined surface for jumps |
| `LOOP` | Ground | Vertical loop |
| `BRIDGE` | Elevated | Road segment at fixed elevation; cars can drive over or under |
| `START_FINISH` | Ground | Spawn point and finish line. Exactly one per track. |

#### Track Envelope
`TrackData` is the top-level object:
- `version`: Integer. Currently `1`. Bumped only when new tile types are added, so the deserializer can reject tracks it can't render rather than silently dropping unknown tiles.
- `grid`: A 16×16 array where each cell is either `null` (empty) or a `TrackTile`.
- `metadata` (optional): `{ name?, author?, description? }`. Editor sugar only — **not serialized into the URL** and **not part of track identity**. Stored alongside high scores in localStorage if present, but two tracks differing only in metadata are the same track.

#### Tile Definition
Each `TrackTile` consists of:
- `type`: One of the tile types above.
- `rotation`: `0`, `90`, `180`, `270` (degrees clockwise).

Position is implicit from the cell's grid coordinates — tiles do not store their own position.

#### Serialization (URL)
The track is serialized into a dense binary string for URL sharing. No JSON, no compression.

1.  **Encoding**: Each cell is encoded as a single byte: tile type (7 values including empty) × rotation (4 values) = 28 combinations, fitting in one byte. The grid is serialized row-by-row (x increments first), producing exactly 256 bytes.
2.  **URL Encoding**: The 256 bytes are encoded as `Base64URL`, producing a fixed-length string of 344 characters. Always under the 2,000-character URL limit.
3.  **Version prefix**: The URL string is prefixed with the version number (e.g., `1:` followed by the Base64URL payload).
4.  **Track Identity**: The serialized URL string **is** the track ID. There is no separate hash. localStorage high scores are keyed directly by this string. The serializer is fixed — there is no remote storage, no syncing, and no future migration path.

### Validation Rules
The deserializer MUST reject a track string if any of these conditions are true:
- Version is higher than the current supported version.
- Payload does not decode to exactly 256 bytes.
- Any byte maps to an unknown tile type.
- The grid does not contain exactly one `START_FINISH` tile.

### Anti-Patterns
- **Y-axis coordinates**: Height is a tile-type property, not a coordinate. Do not add a y-axis.
- **Sparse tile lists**: The format is a dense 16×16 grid, not a list of placed tiles. Empty cells are encoded explicitly.
- **Direct Engine References**: The `TrackData` type must be pure TypeScript and contained in `src/lib/types/`. It must NOT import from Threlte or Rapier.
- **Mutable State**: Once a `TrackData` object is created, it should be treated as immutable. Changes in the editor create a NEW track object.

## Contract (Quality)

### Definition of Done
- [ ] `TrackData` TypeScript interface defined in `src/lib/types/track.ts`.
- [ ] `TrackTile` has no position field — position is implicit from grid coordinates.
- [ ] Serializer converts a 16×16 grid to a fixed-length 344-character Base64URL string (with version prefix).
- [ ] Deserializer reconstructs `TrackData` from a URL string with 100% fidelity.
- [ ] Serialization is deterministic: same grid = same URL string = same track ID.
- [ ] Deserializer rejects invalid tracks per the validation rules above.

### Regression Guardrails
- **Forward Compatibility**: Older track strings should always be readable by newer versions of the engine.
- **Identity Stability**: The same grid layout must always produce the same serialized string. Two identical tracks = same URL = same localStorage key.
- **Fixed Length**: Every track serializes to exactly the same string length (version prefix + 344 chars). This is a natural property of the dense grid encoding and should be asserted in tests.

### Scenarios (Gherkin)

#### Scenario: Encode and decode a basic track
**Given** a 16×16 grid with 1 Straight, 1 Curve, and 1 START_FINISH tile
**When** the track is serialized for a URL
**Then** the resulting string (excluding version prefix) should be exactly 344 characters
**And** decoding the string should return a grid identical to the original

#### Scenario: Round-trip determinism
**Given** a grid with tiles placed in various positions
**When** the grid is serialized, deserialized, and serialized again
**Then** both serialized strings are byte-identical

#### Scenario: Performance
**Given** a fully populated 16×16 grid (256 tiles)
**When** the track is encoded and decoded
**Then** the total operation must take less than 5ms

#### Scenario: Missing START_FINISH
**Given** a grid with no START_FINISH tile
**When** the engine attempts to deserialize the track
**Then** it should reject the track with a descriptive error

#### Scenario: Invalid payload length
**Given** a track string whose Base64URL payload decodes to fewer or more than 256 bytes
**When** the engine attempts to deserialize the track
**Then** it should reject the track with a descriptive error

#### Scenario: Unknown version
**Given** a track string with a version number higher than the current supported version
**When** the engine attempts to deserialize the track
**Then** it should reject the track with a descriptive error

#### Scenario: Empty grid
**Given** a 16×16 grid with only a START_FINISH tile and 255 empty cells
**When** the track is serialized and deserialized
**Then** the round-trip produces an identical grid
