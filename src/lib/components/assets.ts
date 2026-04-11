import { TileType } from "../types/track";

/**
 * Maps each TileType to its corresponding .glb model path.
 *
 * Models sourced from:
 * - Kenney Racing Kit (CC0): straight, curve, ramp, bridge, start-finish
 * - Kenney Toy Car Kit (CC0): loop
 */
export const TILE_ASSETS: Record<TileType, string> = {
	[TileType.STRAIGHT]: "/assets/tiles/straight.glb",
	[TileType.CURVE]: "/assets/tiles/curve.glb",
	[TileType.RAMP]: "/assets/tiles/ramp.glb",
	[TileType.LOOP]: "/assets/tiles/loop.glb",
	[TileType.BRIDGE]: "/assets/tiles/bridge.glb",
	[TileType.START_FINISH]: "/assets/tiles/start-finish.glb",
};
