/**
 * Physics constants for the Paper Cars 2 Physics Controller.
 * All tunable parameters live here as named exports — no magic numbers in controller logic.
 * Spec: specs/game-physics.spec.md
 */

// ---------------------------------------------------------------------------
// Chassis geometry
// ---------------------------------------------------------------------------

/** Half-extents of the chassis collision box, in metres. Matches Kenney toy car proportions. */
export const CHASSIS_HALF_EXTENTS = { x: 0.3, y: 0.1, z: 0.45 } as const;

/** Chassis rigid-body mass in Rapier mass units. Tuned for snappy response. */
export const CHASSIS_MASS = 1.0;

// ---------------------------------------------------------------------------
// Wheel geometry
// ---------------------------------------------------------------------------

/** Wheel radius in metres. Used for raycast suspension and visual scale. */
export const WHEEL_RADIUS = 0.12;

/** Wheel width in metres. Visual only; raycasts have no width. */
export const WHEEL_WIDTH = 0.08;

// ---------------------------------------------------------------------------
// Suspension
// ---------------------------------------------------------------------------

/** Rest length of the wheel suspension spring in metres. */
export const SUSPENSION_REST_LENGTH = 0.15;

/**
 * Suspension spring stiffness.
 * Lower → bouncier; higher → stiffer.
 */
export const SUSPENSION_STIFFNESS = 20.0;

/**
 * Suspension damping coefficient.
 * Critically damped ≈ 2×√stiffness; kept slightly under to allow bounce.
 */
export const SUSPENSION_DAMPING = 2.3;

// ---------------------------------------------------------------------------
// Drivetrain & handling
// ---------------------------------------------------------------------------

/**
 * Lateral friction-slip parameter.
 * Reduce below 0.5 for an ice-track effect (future feature).
 */
export const FRICTION_SLIP = 1.0;

/**
 * Lateral grip stiffness per wheel; reduce below 0.5 for ice-track future feature.
 */
export const SIDE_FRICTION_STIFFNESS = 1.0;

/** Maximum forward speed in m/s. Engine force cuts out above this threshold. */
export const MAX_FORWARD_SPEED = 25.0;

/** Maximum reverse speed in m/s. */
export const MAX_REVERSE_SPEED = 10.0;

/**
 * Engine force applied per rear wheel in Newtons.
 * Set to 100 N (was 15 N) because Rapier's RaycastVehicle friction model requires
 * substantially higher force to reach the spec target of ≥ 15 m/s in 2 s on flat
 * ground. Fun over correctness — fudge the math (VISION.md §5 heuristic #1).
 */
export const ENGINE_FORCE = 100.0;

/**
 * Fraction of max speed at which engine force begins to ramp off, preventing overshoot.
 * Set to 0.6 (top 60% of speed range) to prevent overshoot with the higher ENGINE_FORCE.
 */
export const SPEED_CAP_SOFT_ZONE = 0.6;

/** Braking force applied per wheel in Newtons. */
export const BRAKE_FORCE = 20.0;

/**
 * Automatic braking force applied per wheel when the car exceeds MAX_FORWARD_SPEED
 * or MAX_REVERSE_SPEED. Counteracts integrator overshoot from high ENGINE_FORCE.
 * Fun over correctness — fudge to keep the speed cap crisp (VISION.md §5 heuristic #1).
 */
export const OVERSPEED_BRAKE_FORCE = 30.0;

/** Maximum front-wheel steering deflection in radians (~28.6°). */
export const STEER_ANGLE_MAX = 0.5;

/** Linear interpolation factor per tick toward the target steering angle. Prevents snapping. */
export const STEER_INTERPOLATION = 0.15;

// ---------------------------------------------------------------------------
// Respawn
// ---------------------------------------------------------------------------

/** Speed below which the "stuck" timer begins, in m/s. */
export const RESPAWN_VELOCITY_THRESHOLD = 0.5;

/** Consecutive seconds below RESPAWN_VELOCITY_THRESHOLD before auto-respawn fires. */
export const RESPAWN_STUCK_DURATION = 3.0;

// ---------------------------------------------------------------------------
// Track geometry — Road slab
// ---------------------------------------------------------------------------

/** Half-extent along X for a flat road slab (STRAIGHT / CURVE / START_FINISH / BRIDGE base). */
export const SLAB_HALF_X = 0.5;

/** Half-extent along Y (half-thickness) for a flat road slab. The full slab is 0.05 m thick. */
export const SLAB_HALF_Y = 0.025;

/** Half-extent along Z for a flat road slab. */
export const SLAB_HALF_Z = 0.5;

// ---------------------------------------------------------------------------
// Track geometry — Ramp
// ---------------------------------------------------------------------------

/** Ramp pitch angle in radians (20°). Low enough to climb; steep enough to launch. */
export const RAMP_PITCH_ANGLE = 0.349;

// ---------------------------------------------------------------------------
// Track geometry — Loop
// ---------------------------------------------------------------------------

/** Loop radius in metres. Fits within the 1.0 m tile footprint. */
export const LOOP_RADIUS = 0.5;

/** Number of box segments forming the loop. Octagonal approximation. */
export const LOOP_SEGMENT_COUNT = 8;

/** Thickness of each loop segment in metres. Matches road slab thickness. */
export const LOOP_SEGMENT_THICKNESS = 0.05;

/**
 * Angle of the loop entry ramp in radians.
 * Same as RAMP_PITCH_ANGLE — intentionally equal so the approach feel matches standard ramps.
 */
export const LOOP_ENTRY_RAMP_ANGLE = RAMP_PITCH_ANGLE;

// ---------------------------------------------------------------------------
// Track geometry — Bridge
// ---------------------------------------------------------------------------

/** Fixed elevation of bridge tiles in metres. Must match the Kenney bridge asset visual height. */
export const BRIDGE_ELEVATION = 0.8;

// ---------------------------------------------------------------------------
// World / grid
// ---------------------------------------------------------------------------

/** Side length of one grid tile in metres. Defines the grid-to-world scale. */
export const TILE_SIZE = 1.0;

/** Rapier world gravity Y component in m/s². Exaggerated for toy-car feel. */
export const PHYSICS_GRAVITY_Y = -20.0;

/**
 * Y threshold below which the car is considered to have fallen off the track.
 * Triggers immediate respawn.
 */
export const FALL_OFF_Y_THRESHOLD = -5.0;

// ---------------------------------------------------------------------------
// Simulation timestep
// ---------------------------------------------------------------------------

/**
 * Fixed physics timestep in seconds (60 Hz).
 * All physics ticks run at this interval; the renderer reads VehicleState each animation frame.
 */
export const PHYSICS_TIMESTEP = 1 / 60;

// ---------------------------------------------------------------------------
// Wheel layout — chassis-local positions
// ---------------------------------------------------------------------------

/**
 * Chassis-local attachment positions for each wheel.
 * Front wheels receive steering; rear wheels receive engine force and braking.
 * Spec: game-physics.spec.md §Wheel layout
 */
export const WHEEL_POSITIONS = [
	{ x: -0.3, y: -0.1, z: 0.35 }, // front-left
	{ x: 0.3, y: -0.1, z: 0.35 }, // front-right
	{ x: -0.3, y: -0.1, z: -0.35 }, // rear-left
	{ x: 0.3, y: -0.1, z: -0.35 }, // rear-right
] as const;

// ---------------------------------------------------------------------------
// Spawn
// ---------------------------------------------------------------------------

/**
 * Small vertical clearance added above chassis half-height + wheel radius when spawning.
 * Prevents the chassis from intersecting the ground collider on the first tick.
 */
export const CHASSIS_SPAWN_CLEARANCE = 0.05;

// ---------------------------------------------------------------------------
// Derived constants (computed from primitives above — do NOT change directly)
// ---------------------------------------------------------------------------

/**
 * Y offset applied to chassis centre when spawning or respawning.
 * Equals half-height + wheel radius + clearance so the car starts above ground.
 */
export const CHASSIS_SPAWN_OFFSET_Y =
	CHASSIS_HALF_EXTENTS.y + WHEEL_RADIUS + CHASSIS_SPAWN_CLEARANCE;

/**
 * Maximum suspension travel in metres.
 * Must be large enough for the car to reach suspension equilibrium under
 * exaggerated gravity. Required compression ≈ weight / (4 × stiffness)
 * = (CHASSIS_MASS × |PHYSICS_GRAVITY_Y|) / (4 × SUSPENSION_STIFFNESS) ≈ 0.25 m.
 * Set to 0.5 m for headroom on rough surfaces.
 */
export const SUSPENSION_MAX_TRAVEL = 0.5;
