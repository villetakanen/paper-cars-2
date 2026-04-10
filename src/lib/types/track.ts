/**
 * Paper Cars 2 - Track Format Types
 * This file is the primary cross-module contract.
 * See specs/track-format.spec.md for details.
 */

export type TileType =
	| "STRAIGHT"
	| "CURVE"
	| "RAMP"
	| "LOOP"
	| "BRIDGE"
	| "START_FINISH";

export type Rotation = 0 | 90 | 180 | 270;

export interface TrackTile {
	/** The tile variety */
	type: TileType;
	/** Clockwise rotation in degrees */
	rotation: Rotation;
}

/** Fixed 16×16 grid. null = empty cell. */
export type TrackGrid = (TrackTile | null)[][];

export const GRID_SIZE = 16;

export interface TrackData {
	/** Schema version — currently 1 */
	version: 1;
	/** 16×16 grid of tiles. Position is implicit from array indices [x][z]. */
	grid: TrackGrid;
	/** Editor sugar only — not serialized, not part of track identity */
	metadata?: {
		name?: string;
		author?: string;
		description?: string;
	};
}
