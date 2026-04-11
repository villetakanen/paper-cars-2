/**
 * PhysicsController — Rapier.js vehicle simulation for Paper Cars 2.
 *
 * Architecture boundaries (MUST NOT import from):
 *   src/lib/components/, src/lib/ui/, src/lib/scoring/, src/lib/grid/
 *
 * Allowed imports: @dimforge/rapier3d-compat, src/lib/types/track.ts
 *
 * Spec: specs/game-physics.spec.md
 */

import type {
	DynamicRayCastVehicleController,
	RigidBody,
	World,
} from "@dimforge/rapier3d-compat";
import RAPIER from "@dimforge/rapier3d-compat";

import { TileType, type TrackData } from "../types/track";

import {
	BRAKE_FORCE,
	BRIDGE_ELEVATION,
	CHASSIS_HALF_EXTENTS,
	CHASSIS_MASS,
	CHASSIS_SPAWN_OFFSET_Y,
	ENGINE_FORCE,
	FALL_OFF_Y_THRESHOLD,
	FRICTION_SLIP,
	LOOP_ENTRY_RAMP_ANGLE,
	LOOP_RADIUS,
	LOOP_SEGMENT_COUNT,
	LOOP_SEGMENT_THICKNESS,
	MAX_FORWARD_SPEED,
	MAX_REVERSE_SPEED,
	OVERSPEED_BRAKE_FORCE,
	PHYSICS_GRAVITY_Y,
	PHYSICS_TIMESTEP,
	RAMP_PITCH_ANGLE,
	RESPAWN_STUCK_DURATION,
	RESPAWN_VELOCITY_THRESHOLD,
	SIDE_FRICTION_STIFFNESS,
	SLAB_HALF_X,
	SLAB_HALF_Y,
	SLAB_HALF_Z,
	SPEED_CAP_SOFT_ZONE,
	STEER_ANGLE_MAX,
	STEER_INTERPOLATION,
	SUSPENSION_DAMPING,
	SUSPENSION_MAX_TRAVEL,
	SUSPENSION_REST_LENGTH,
	SUSPENSION_STIFFNESS,
	TILE_SIZE,
	WHEEL_POSITIONS,
	WHEEL_RADIUS,
} from "./constants";
import type { InputVector, VehicleState } from "./types";

// Wheel indices for the vehicle controller (match order in WHEEL_POSITIONS constant)
const WHEEL_FRONT_LEFT = 0;
const WHEEL_FRONT_RIGHT = 1;
const WHEEL_REAR_LEFT = 2;
const WHEEL_REAR_RIGHT = 3;
const WHEEL_COUNT = 4;

/** Y centre of a ground-level slab: half its height above y = 0. */
const SLAB_CENTRE_Y = SLAB_HALF_Y;

/** Y centre of a bridge slab. */
const BRIDGE_SLAB_CENTRE_Y = BRIDGE_ELEVATION + SLAB_HALF_Y;

/** Convert degrees-CW tile rotation to radians for a Y-axis quaternion. */
function degToYQuat(deg: number): {
	x: number;
	y: number;
	z: number;
	w: number;
} {
	const rad = (deg * Math.PI) / 180;
	const halfAngle = rad / 2;
	return { x: 0, y: Math.sin(halfAngle), z: 0, w: Math.cos(halfAngle) };
}

/** Create an X-axis rotation quaternion (for ramp pitch). */
function xAxisQuat(angle: number): {
	x: number;
	y: number;
	z: number;
	w: number;
} {
	const half = angle / 2;
	return { x: Math.sin(half), y: 0, z: 0, w: Math.cos(half) };
}

/** Multiply two quaternions: out = a * b */
function mulQuat(
	a: { x: number; y: number; z: number; w: number },
	b: { x: number; y: number; z: number; w: number },
): { x: number; y: number; z: number; w: number } {
	return {
		x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
		y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
		z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
		w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
	};
}

/**
 * Add static flat-slab colliders for tile types STRAIGHT, CURVE, and START_FINISH.
 */
function addSlabCollider(
	world: World,
	worldX: number,
	worldZ: number,
	centreY: number,
	rotationDeg: number,
): void {
	const rot = degToYQuat(rotationDeg);
	const desc = RAPIER.ColliderDesc.cuboid(SLAB_HALF_X, SLAB_HALF_Y, SLAB_HALF_Z)
		.setTranslation(worldX, centreY, worldZ)
		.setRotation(rot);
	world.createCollider(desc);
}

/**
 * Add a ramp collider (inclined box, bottom edge at y = 0).
 *
 * The ramp slab is first rotated by RAMP_PITCH_ANGLE around X, then by the tile's
 * Y rotation so orientation matches the tile's facing direction.
 *
 * Bottom-edge constraint: the slab rotates about the centre so the bottom (entry)
 * edge stays at y ≈ 0. The centre of the rotated slab is lifted by
 *   SLAB_HALF_Y * cos(pitch) + SLAB_HALF_Z * sin(pitch)
 * and shifted in Z by
 *   SLAB_HALF_Z * cos(pitch) - SLAB_HALF_Y * sin(pitch)
 */
function addRampCollider(
	world: World,
	worldX: number,
	worldZ: number,
	rotationDeg: number,
): void {
	const pitch = RAMP_PITCH_ANGLE;
	// Centre offset in local (pre-tile-rotation) frame:
	const centreY = SLAB_HALF_Y * Math.cos(pitch) + SLAB_HALF_Z * Math.sin(pitch);
	const centreZLocal =
		SLAB_HALF_Z * Math.cos(pitch) - SLAB_HALF_Y * Math.sin(pitch);

	// Apply tile Y rotation to the centre offset
	const tileRad = (rotationDeg * Math.PI) / 180;
	const cx = worldX - Math.sin(tileRad) * centreZLocal;
	const cz = worldZ - Math.cos(tileRad) * centreZLocal;

	// Combined rotation: tile Y first, then pitch around X
	const yRot = degToYQuat(rotationDeg);
	const xRot = xAxisQuat(pitch);
	const combined = mulQuat(yRot, xRot);

	const desc = RAPIER.ColliderDesc.cuboid(SLAB_HALF_X, SLAB_HALF_Y, SLAB_HALF_Z)
		.setTranslation(cx, centreY, cz)
		.setRotation(combined);
	world.createCollider(desc);
}

/**
 * Add loop colliders: LOOP_SEGMENT_COUNT box segments arranged in a vertical circle
 * of radius LOOP_RADIUS centred at the tile's world position, plus entry and exit
 * ramp boxes (inclined at LOOP_ENTRY_RAMP_ANGLE) at the bottom front and back of
 * the loop to smooth the flat-ground → loop transition.
 */
function addLoopColliders(
	world: World,
	worldX: number,
	worldZ: number,
	rotationDeg: number,
): void {
	const n = LOOP_SEGMENT_COUNT;
	const r = LOOP_RADIUS;
	const segHalfLen = r * Math.tan(Math.PI / n); // chord half-length
	const halfThick = LOOP_SEGMENT_THICKNESS / 2;
	const tileRad = (rotationDeg * Math.PI) / 180;

	for (let i = 0; i < n; i++) {
		// Angle to the centre of this segment (in the loop's vertical plane)
		const angle = (i / n) * 2 * Math.PI;
		// Loop centre is at y = LOOP_RADIUS; segment centre offset from there:
		const loopCentreY = r;
		const segCentreYLocal = loopCentreY + r * Math.sin(angle - Math.PI / 2);
		const segCentreZLocal = r * Math.cos(angle - Math.PI / 2); // forward offset in tile-local Z

		// Rotation of segment: segment is perpendicular to the radial direction.
		// Segment box local x = width, y = thickness, z = along-loop-arc.
		// The segment needs to be rotated by `angle` around X-axis (in loop plane)
		// then by tile Y rotation.
		const segXRot = xAxisQuat(angle);
		const tileYRot = degToYQuat(rotationDeg);
		const combined = mulQuat(tileYRot, segXRot);

		// World position: apply tile Y rotation to segCentreZLocal
		const wx = worldX + Math.sin(tileRad) * segCentreZLocal;
		const wy = segCentreYLocal;
		const wz = worldZ + Math.cos(tileRad) * segCentreZLocal;

		const desc = RAPIER.ColliderDesc.cuboid(SLAB_HALF_X, halfThick, segHalfLen)
			.setTranslation(wx, wy, wz)
			.setRotation(combined);
		world.createCollider(desc);
	}

	// Entry ramp: inclined box at the -Z edge of the loop tile.
	// Exit ramp: inclined box at the +Z edge of the loop tile.
	// Both use LOOP_ENTRY_RAMP_ANGLE to blend the flat ground → loop transition.
	// The ramp bottom edge is placed at the tile boundary (±SLAB_HALF_Z from tile centre);
	// the ramp centre is inset by the horizontal projection of the slab half-length so that
	// the ramp stays within (or just at) the tile footprint.
	const entryPitch = LOOP_ENTRY_RAMP_ANGLE;
	const exitPitch = -LOOP_ENTRY_RAMP_ANGLE;

	for (const [pitch, sign] of [
		[entryPitch, -1] as const,
		[exitPitch, 1] as const,
	]) {
		const absPitch = Math.abs(pitch);
		// Slab centre height and horizontal offset from its own bottom edge:
		const centreY =
			SLAB_HALF_Y * Math.cos(absPitch) + SLAB_HALF_Z * Math.sin(absPitch);
		const absCentreZLocal =
			SLAB_HALF_Z * Math.cos(absPitch) - SLAB_HALF_Y * Math.sin(absPitch);
		// Place the ramp bottom edge at the tile boundary (sign * SLAB_HALF_Z),
		// then shift toward tile centre by the slab's own horizontal half-length.
		// Result: ramp centre at sign * (SLAB_HALF_Z - absCentreZLocal) ≈ ±0.039 m from tile
		// centre, keeping the ramp almost entirely within the 1.0 m tile footprint.
		const totalZLocal = sign * (SLAB_HALF_Z - absCentreZLocal);

		// Apply tile Y rotation to the Z offset to get world position
		const wx = worldX + Math.sin(tileRad) * totalZLocal;
		const wz = worldZ + Math.cos(tileRad) * totalZLocal;

		const yRot = degToYQuat(rotationDeg);
		const xRot = xAxisQuat(pitch);
		const combined = mulQuat(yRot, xRot);

		const desc = RAPIER.ColliderDesc.cuboid(
			SLAB_HALF_X,
			SLAB_HALF_Y,
			SLAB_HALF_Z,
		)
			.setTranslation(wx, centreY, wz)
			.setRotation(combined);
		world.createCollider(desc);
	}
}

/**
 * Find the world position of the START_FINISH tile in TrackData.
 * Returns null if no such tile exists.
 */
function findStartFinishPosition(
	trackData: TrackData,
): { x: number; z: number; rotationDeg: number } | null {
	for (let rowIdx = 0; rowIdx < trackData.grid.length; rowIdx++) {
		const row = trackData.grid[rowIdx];
		for (let colIdx = 0; colIdx < row.length; colIdx++) {
			const tile = row[colIdx];
			if (tile !== null && tile.type === TileType.START_FINISH) {
				return {
					x: colIdx * TILE_SIZE,
					z: rowIdx * TILE_SIZE,
					rotationDeg: tile.rotation,
				};
			}
		}
	}
	return null;
}

export class PhysicsController {
	// Reactive vehicle state — Svelte 5 $state
	vehicleState: VehicleState = $state({
		position: { x: 0, y: 0, z: 0 },
		rotation: { x: 0, y: 0, z: 0, w: 1 },
		speed: 0,
		velocityY: 0,
		isAirborne: false,
		airtime: 0,
		angularVelocity: { x: 0, y: 0, z: 0 },
	});

	private world: World | null = null;
	private chassis: RigidBody | null = null;
	private vehicle: DynamicRayCastVehicleController | null = null;

	/** Current steering angle (radians), interpolated toward target each tick. */
	private currentSteer = 0;

	/** Accumulated time (seconds) the car has been below RESPAWN_VELOCITY_THRESHOLD. */
	private stuckTimer = 0;

	/** Cached respawn position from the last buildCollisionWorld call. */
	private spawnPos: { x: number; y: number; z: number } = {
		x: 0,
		y: CHASSIS_SPAWN_OFFSET_Y,
		z: 0,
	};

	/** Cached spawn Y-rotation quaternion for facing direction. */
	private spawnRot: { x: number; y: number; z: number; w: number } = {
		x: 0,
		y: 0,
		z: 0,
		w: 1,
	};

	/**
	 * Build the Rapier physics world from track data.
	 * Must be called before `step()`. Requires Rapier WASM to be initialized.
	 * @throws If Rapier WASM is not yet initialized.
	 */
	async buildCollisionWorld(trackData: TrackData): Promise<void> {
		// Initialize Rapier WASM (idempotent — safe to call multiple times)
		await RAPIER.init();

		// Tear down any existing world
		this.dispose();

		// Create world with exaggerated gravity for toy-car feel
		const world = new RAPIER.World({ x: 0, y: PHYSICS_GRAVITY_Y, z: 0 });
		world.timestep = PHYSICS_TIMESTEP;

		// Build static colliders for every non-null tile
		for (let rowIdx = 0; rowIdx < trackData.grid.length; rowIdx++) {
			const row = trackData.grid[rowIdx];
			for (let colIdx = 0; colIdx < row.length; colIdx++) {
				const tile = row[colIdx];
				if (tile === null) continue;

				const worldX = colIdx * TILE_SIZE;
				const worldZ = rowIdx * TILE_SIZE;
				const rotDeg = tile.rotation;

				switch (tile.type) {
					case TileType.STRAIGHT:
					case TileType.CURVE:
					case TileType.START_FINISH:
						addSlabCollider(world, worldX, worldZ, SLAB_CENTRE_Y, rotDeg);
						break;
					case TileType.RAMP:
						addRampCollider(world, worldX, worldZ, rotDeg);
						break;
					case TileType.LOOP:
						addLoopColliders(world, worldX, worldZ, rotDeg);
						break;
					case TileType.BRIDGE:
						addSlabCollider(
							world,
							worldX,
							worldZ,
							BRIDGE_SLAB_CENTRE_Y,
							rotDeg,
						);
						break;
				}
			}
		}

		// Determine spawn position from START_FINISH tile (or world origin)
		const sf = findStartFinishPosition(trackData);
		if (sf !== null) {
			this.spawnPos = { x: sf.x, y: CHASSIS_SPAWN_OFFSET_Y, z: sf.z };
			this.spawnRot = degToYQuat(sf.rotationDeg);
		} else {
			this.spawnPos = { x: 0, y: CHASSIS_SPAWN_OFFSET_Y, z: 0 };
			this.spawnRot = { x: 0, y: 0, z: 0, w: 1 };
		}

		// Create dynamic chassis rigid body
		const chassisDesc = RAPIER.RigidBodyDesc.dynamic()
			.setTranslation(this.spawnPos.x, this.spawnPos.y, this.spawnPos.z)
			.setRotation(this.spawnRot)
			.setAdditionalMass(CHASSIS_MASS);

		const chassis = world.createRigidBody(chassisDesc);

		// Attach a box collider to the chassis (no extra mass — mass set on body)
		const chassisColliderDesc = RAPIER.ColliderDesc.cuboid(
			CHASSIS_HALF_EXTENTS.x,
			CHASSIS_HALF_EXTENTS.y,
			CHASSIS_HALF_EXTENTS.z,
		).setMass(0); // mass already set on rigid body
		world.createCollider(chassisColliderDesc, chassis);

		// Create vehicle controller
		const vehicle = world.createVehicleController(chassis);

		// Suspension direction: downward (-Y) in chassis-local space
		const suspDir = { x: 0, y: -1, z: 0 };
		// Axle direction: along X-axis in chassis-local space
		const axle = { x: -1, y: 0, z: 0 };

		// Add four wheels
		for (let wi = 0; wi < WHEEL_COUNT; wi++) {
			const pos = WHEEL_POSITIONS[wi];
			vehicle.addWheel(
				pos,
				suspDir,
				axle,
				SUSPENSION_REST_LENGTH,
				WHEEL_RADIUS,
			);
			vehicle.setWheelSuspensionStiffness(wi, SUSPENSION_STIFFNESS);
			vehicle.setWheelSuspensionCompression(wi, SUSPENSION_DAMPING);
			vehicle.setWheelSuspensionRelaxation(wi, SUSPENSION_DAMPING);
			vehicle.setWheelFrictionSlip(wi, FRICTION_SLIP);
			// Side friction stiffness — higher = more lateral grip (car drives straight)
			vehicle.setWheelSideFrictionStiffness(wi, SIDE_FRICTION_STIFFNESS);
			// Allow generous suspension travel so the car can reach equilibrium
			// under exaggerated gravity (see SUSPENSION_MAX_TRAVEL in constants.ts).
			vehicle.setWheelMaxSuspensionTravel(wi, SUSPENSION_MAX_TRAVEL);
		}

		this.world = world;
		this.chassis = chassis;
		this.vehicle = vehicle;
		this.currentSteer = 0;
		this.stuckTimer = 0;

		// Sync vehicleState to spawn position
		this.syncState();
	}

	/**
	 * Advance physics by one fixed tick.
	 * Call at 60 Hz. `delta` should be ~1/60 s.
	 */
	step(input: InputVector, delta: number): void {
		if (this.world === null || this.chassis === null || this.vehicle === null)
			return;

		const { throttle, steer, brake, reset } = input;

		// Immediate respawn on player request
		if (reset) {
			this.doRespawn(this.chassis);
			// Zero all wheel forces before stepping so vehicle speed resets
			for (let wi = 0; wi < WHEEL_COUNT; wi++) {
				this.vehicle.setWheelEngineForce(wi, 0);
				this.vehicle.setWheelBrake(wi, 0);
			}
			this.vehicle.updateVehicle(delta);
			this.world.step();
			this.syncState();
			return;
		}

		// Interpolate steering angle toward target
		const targetSteer = steer * STEER_ANGLE_MAX;
		this.currentSteer +=
			(targetSteer - this.currentSteer) * STEER_INTERPOLATION;

		// Apply steering to front wheels
		this.vehicle.setWheelSteering(WHEEL_FRONT_LEFT, this.currentSteer);
		this.vehicle.setWheelSteering(WHEEL_FRONT_RIGHT, this.currentSteer);

		// Determine current speed for cap enforcement
		const currentSpeed = this.vehicle.currentVehicleSpeed();

		// Apply engine force to rear wheels.
		// Engine cuts out at MAX_FORWARD_SPEED / MAX_REVERSE_SPEED. A soft ramp over
		// the top SPEED_CAP_SOFT_ZONE fraction of the speed range prevents the integrator
		// from overshooting the cap significantly.
		let engineForce = 0;
		if (throttle > 0 && currentSpeed < MAX_FORWARD_SPEED) {
			const headroom = MAX_FORWARD_SPEED - currentSpeed;
			const softZone = MAX_FORWARD_SPEED * SPEED_CAP_SOFT_ZONE;
			const scale = Math.min(1.0, headroom / softZone);
			engineForce = throttle * ENGINE_FORCE * scale;
		} else if (throttle < 0 && currentSpeed > -MAX_REVERSE_SPEED) {
			const headroom = MAX_REVERSE_SPEED + currentSpeed; // currentSpeed is negative
			const softZone = MAX_REVERSE_SPEED * SPEED_CAP_SOFT_ZONE;
			const scale = Math.min(1.0, headroom / softZone);
			engineForce = throttle * ENGINE_FORCE * scale;
		}
		this.vehicle.setWheelEngineForce(WHEEL_REAR_LEFT, engineForce);
		this.vehicle.setWheelEngineForce(WHEEL_REAR_RIGHT, engineForce);

		// Apply braking to all wheels.
		// Also apply automatic overspeed brake when speed exceeds the cap — this prevents
		// integrator overshoot caused by the high ENGINE_FORCE value.
		const isOverspeedForward =
			currentSpeed > MAX_FORWARD_SPEED && throttle >= 0;
		const isOverspeedReverse =
			currentSpeed < -MAX_REVERSE_SPEED && throttle <= 0;
		const overspeedBrake =
			isOverspeedForward || isOverspeedReverse ? OVERSPEED_BRAKE_FORCE : 0;
		const brakeForce = brake ? BRAKE_FORCE : overspeedBrake;
		for (let wi = 0; wi < WHEEL_COUNT; wi++) {
			this.vehicle.setWheelBrake(wi, brakeForce);
		}

		// Step vehicle controller, then world
		this.vehicle.updateVehicle(delta);
		this.world.step();

		// Determine airborne state from wheel contact
		let anyContact = false;
		for (let wi = 0; wi < WHEEL_COUNT; wi++) {
			if (this.vehicle.wheelIsInContact(wi)) {
				anyContact = true;
				break;
			}
		}
		const wasAirborne = this.vehicleState.isAirborne;
		if (anyContact) {
			this.vehicleState.isAirborne = false;
			this.vehicleState.airtime = 0;
		} else {
			this.vehicleState.isAirborne = true;
			if (wasAirborne) {
				this.vehicleState.airtime += delta;
			} else {
				// First airborne tick: reset to 0; airtime accumulates from next tick onward
				this.vehicleState.airtime = 0;
			}
		}

		// Sync position / rotation / velocity to vehicleState
		this.syncState();

		// Respawn checks
		const pos = this.chassis.translation();
		const speed = Math.abs(this.vehicle.currentVehicleSpeed());

		// Fall-off respawn
		if (pos.y < FALL_OFF_Y_THRESHOLD) {
			this.doRespawn(this.chassis);
			return;
		}

		// Stuck respawn
		if (speed < RESPAWN_VELOCITY_THRESHOLD) {
			this.stuckTimer += delta;
			if (this.stuckTimer >= RESPAWN_STUCK_DURATION) {
				this.doRespawn(this.chassis);
			}
		} else {
			this.stuckTimer = 0;
		}
	}

	/**
	 * Teleport the chassis to the spawn point and zero all velocities.
	 */
	private doRespawn(chassis: RigidBody): void {
		chassis.setTranslation(this.spawnPos, true);
		chassis.setRotation(this.spawnRot, true);
		chassis.setLinvel({ x: 0, y: 0, z: 0 }, true);
		chassis.setAngvel({ x: 0, y: 0, z: 0 }, true);
		this.stuckTimer = 0;
		this.currentSteer = 0;
		this.vehicleState.isAirborne = false;
		this.vehicleState.airtime = 0;
		this.syncState();
	}

	/**
	 * Synchronise the reactive vehicleState from the Rapier chassis state.
	 */
	private syncState(): void {
		if (this.chassis === null) return;

		const pos = this.chassis.translation();
		const rot = this.chassis.rotation();
		const vel = this.chassis.linvel();
		const ang = this.chassis.angvel();
		const speed =
			this.vehicle !== null ? Math.abs(this.vehicle.currentVehicleSpeed()) : 0;

		this.vehicleState.position = { x: pos.x, y: pos.y, z: pos.z };
		this.vehicleState.rotation = { x: rot.x, y: rot.y, z: rot.z, w: rot.w };
		this.vehicleState.speed = speed;
		this.vehicleState.velocityY = vel.y;
		this.vehicleState.angularVelocity = { x: ang.x, y: ang.y, z: ang.z };
	}

	/**
	 * Returns the Y translation of every collider currently in the physics world.
	 * Includes both static track colliders and the dynamic chassis collider.
	 * @internal Exposed for unit testing only — do not call from game code.
	 */
	getColliderYPositions(): number[] {
		if (this.world === null) return [];
		const result: number[] = [];
		this.world.forEachCollider((c) => {
			result.push(c.translation().y);
		});
		return result;
	}

	/**
	 * Free all Rapier WASM memory. Call when leaving Drive Mode.
	 */
	dispose(): void {
		if (this.world !== null) {
			this.world.free();
			this.world = null;
			this.chassis = null;
			this.vehicle = null;
		}
	}
}
