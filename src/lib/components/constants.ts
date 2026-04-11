/**
 * World-space size of one grid cell.
 * Shared by Renderer and Physics for coordinate alignment.
 */
export const TILE_SIZE = 1.0;

/**
 * Grid dimensions (matches Grid Manager).
 */
export const GRID_SIZE = 16;

// ---------------------------------------------------------------------------
// Chase camera (Drive Mode)
// ---------------------------------------------------------------------------

/** Distance behind the car in world units. */
export const CHASE_DISTANCE = 3.0;

/** Camera height above the car. */
export const CHASE_HEIGHT = 1.5;

/** How far ahead of the car the camera looks. */
export const CHASE_LOOK_AHEAD = 2.0;

/** Lerp factor per frame for camera position (higher = more responsive). */
export const CHASE_SMOOTHING = 0.15;

/** Lerp factor per frame for camera look target (higher = snappier rotation tracking). */
export const CHASE_LOOK_SMOOTHING = 0.25;
