/**
 * Reactive state exported by the Physics Controller each tick.
 * All other modules (Renderer, Score Manager) read this; only Physics writes it.
 */
export interface VehicleState {
	/** World-space position in metres. */
	position: { x: number; y: number; z: number };
	/** World-space orientation as a unit quaternion. */
	rotation: { x: number; y: number; z: number; w: number };
	/** Scalar speed in m/s (always ≥ 0). */
	speed: number;
	/** Vertical velocity component in m/s (positive = ascending). */
	velocityY: number;
	/** True when all four wheel raycasts miss any geometry. */
	isAirborne: boolean;
	/** Seconds spent continuously airborne; resets to 0 on first wheel contact. */
	airtime: number;
	/** Angular velocity in rad/s. */
	angularVelocity: { x: number; y: number; z: number };
}

/**
 * One tick of player input. The Physics Controller is input-agnostic — Drive Mode
 * owns the keyboard → InputVector mapping.
 */
export interface InputVector {
	/** Forward throttle [0..1] or reverse throttle [-1..0]. */
	throttle: number;
	/** Steering: -1.0 = full left, 1.0 = full right. */
	steer: number;
	/** True to apply braking force on all wheels. */
	brake: boolean;
	/** True to request immediate respawn at the START_FINISH tile. */
	reset: boolean;
}
