import { TileType } from "../types/track";

/**
 * Maps each TileType to its corresponding .glb model path.
 *
 * All models are Kenney.nl CC0 assets. Sources:
 *   straight      — Kenney Toy Car Kit: track-road-narrow-straight.glb
 *   curve         — Kenney Toy Car Kit: track-road-narrow-corner-small.glb
 *   ramp          — Kenney Toy Car Kit: track-road-narrow-straight-hill-beginning.glb
 *   loop          — Kenney Toy Car Kit: track-road-narrow-looping.glb
 *   bridge        — Kenney Racing Kit:  roadStraightBridge.glb
 *   start-finish  — Kenney Toy Car Kit: gate-finish.glb
 *
 * Vehicle model (for Drive Mode):
 *   /assets/vehicles/racer.glb — Kenney Toy Car Kit: vehicle-racer.glb
 */
export const TILE_ASSETS: Record<TileType, string> = {
	[TileType.STRAIGHT]: "/assets/tiles/straight.glb",
	[TileType.CURVE]: "/assets/tiles/curve.glb",
	[TileType.RAMP]: "/assets/tiles/ramp.glb",
	[TileType.LOOP]: "/assets/tiles/loop.glb",
	[TileType.BRIDGE]: "/assets/tiles/bridge.glb",
	[TileType.START_FINISH]: "/assets/tiles/start-finish.glb",
};

/** Path to the player vehicle model. Used by Drive Mode (Epic 5). */
export const VEHICLE_ASSET = "/assets/vehicles/racer.glb";
