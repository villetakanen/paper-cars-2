/**
 * Core Tile Types supported by the track format.
 * Matches specs/track-format.spec.md
 */
export enum TileType {
	STRAIGHT = "STRAIGHT",
	CURVE = "CURVE",
	RAMP = "RAMP",
	LOOP = "LOOP",
	BRIDGE = "BRIDGE",
	START_FINISH = "START_FINISH",
}

/**
 * Valid rotation values in degrees clockwise.
 */
export type Rotation = 0 | 90 | 180 | 270;

/**
 * Individual Tile data structure.
 * Position is implicit from grid coordinates.
 */
export interface TrackTile {
	type: TileType;
	rotation: Rotation;
}

/**
 * A fixed 16x16 2D grid of tiles.
 * Grid is row-major: [rowIndex][columnIndex] => [z][x]
 */
export type TrackGrid = (TrackTile | null)[][];

/**
 * Top-level Track Data structure.
 * This is the primary contract for sharing and persistence.
 */
export interface TrackData {
	/**
	 * Format version. Currently 1.
	 */
	version: number;
	/**
	 * The 16x16 grid of tiles.
	 */
	grid: TrackGrid;
	/**
	 * Optional metadata for display/editor purposes.
	 * Not used for track identity or URL serialization.
	 */
	metadata?: {
		name?: string;
		author?: string;
		description?: string;
	};
}
