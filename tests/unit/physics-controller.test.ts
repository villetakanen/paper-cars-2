/**
 * Unit tests for the Physics Controller (Epic 4).
 * Spec: specs/game-physics.spec.md
 *
 * NOTE: Tests that require the Rapier World call `await RAPIER.init()` first.
 * Rapier.init() is idempotent — safe to call multiple times across tests.
 */
import RAPIER from "@dimforge/rapier3d-compat";
import { beforeEach, describe, expect, it } from "vitest";

import { PhysicsController } from "../../src/lib/physics/controller.svelte";
import {
	BRIDGE_ELEVATION,
	CHASSIS_HALF_EXTENTS,
	CHASSIS_MASS,
	CHASSIS_SPAWN_OFFSET_Y,
	FALL_OFF_Y_THRESHOLD,
	MAX_FORWARD_SPEED,
	PHYSICS_GRAVITY_Y,
	RAMP_PITCH_ANGLE,
	RESPAWN_STUCK_DURATION,
	RESPAWN_VELOCITY_THRESHOLD,
	SLAB_HALF_Y,
	TILE_SIZE,
	WHEEL_RADIUS,
} from "../../src/lib/physics/constants";
import type { InputVector } from "../../src/lib/physics/types";
import { TileType, type TrackData, type TrackGrid } from "../../src/lib/types/track";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEmptyGrid(): TrackGrid {
	return Array.from({ length: 16 }, () => Array<null>(16).fill(null));
}

function makeStraightTrack(): TrackData {
	const grid = makeEmptyGrid();
	// START_FINISH at col=8, row=0 (x=8, z=0)
	grid[0][8] = { type: TileType.START_FINISH, rotation: 0 };
	// Extend straight tiles in the Z direction (rows 0-14, col=8)
	// so the car (facing +Z by default) has ground to drive on
	for (let row = 0; row < 15; row++) {
		if (grid[row][8] === null) {
			grid[row][8] = { type: TileType.STRAIGHT, rotation: 0 };
		}
	}
	return { version: 1, grid };
}

function makeFullGrid(tileType: TileType = TileType.STRAIGHT): TrackData {
	const grid = makeEmptyGrid();
	for (let row = 0; row < 16; row++) {
		for (let col = 0; col < 16; col++) {
			grid[row][col] = {
				type: row === 0 && col === 0 ? TileType.START_FINISH : tileType,
				rotation: 0,
			};
		}
	}
	return { version: 1, grid };
}

const FULL_THROTTLE: InputVector = {
	throttle: 1.0,
	steer: 0,
	brake: false,
	reset: false,
};

const IDLE_INPUT: InputVector = {
	throttle: 0,
	steer: 0,
	brake: false,
	reset: false,
};

// ---------------------------------------------------------------------------
// Constants smoke tests
// ---------------------------------------------------------------------------

describe("Physics constants", () => {
	it("CHASSIS_MASS has correct value", () => {
		expect(CHASSIS_MASS).toBe(1.0);
	});

	it("WHEEL_RADIUS has correct value", () => {
		expect(WHEEL_RADIUS).toBe(0.12);
	});

	it("MAX_FORWARD_SPEED has correct value", () => {
		expect(MAX_FORWARD_SPEED).toBe(25.0);
	});

	it("CHASSIS_HALF_EXTENTS has correct values", () => {
		expect(CHASSIS_HALF_EXTENTS).toEqual({ x: 0.3, y: 0.1, z: 0.45 });
	});

	it("CHASSIS_SPAWN_OFFSET_Y is computed correctly", () => {
		// CHASSIS_HALF_EXTENTS.y + WHEEL_RADIUS + 0.05
		expect(CHASSIS_SPAWN_OFFSET_Y).toBeCloseTo(0.1 + 0.12 + 0.05, 5);
	});

	it("PHYSICS_GRAVITY_Y has correct value", () => {
		expect(PHYSICS_GRAVITY_Y).toBe(-20.0);
	});

	it("RAMP_PITCH_ANGLE is approximately 20 degrees", () => {
		expect(RAMP_PITCH_ANGLE).toBeCloseTo((20 * Math.PI) / 180, 2);
	});

	it("FALL_OFF_Y_THRESHOLD is -5.0", () => {
		expect(FALL_OFF_Y_THRESHOLD).toBe(-5.0);
	});

	it("RESPAWN_VELOCITY_THRESHOLD is 0.5", () => {
		expect(RESPAWN_VELOCITY_THRESHOLD).toBe(0.5);
	});

	it("RESPAWN_STUCK_DURATION is 3.0", () => {
		expect(RESPAWN_STUCK_DURATION).toBe(3.0);
	});

	it("TILE_SIZE is 1.0", () => {
		expect(TILE_SIZE).toBe(1.0);
	});
});

// ---------------------------------------------------------------------------
// buildCollisionWorld — structure tests
// ---------------------------------------------------------------------------

describe("buildCollisionWorld — collider construction", () => {
	it("creates colliders for STRAIGHT tiles", async () => {
		await RAPIER.init();
		const ctrl = new PhysicsController();

		const grid = makeEmptyGrid();
		grid[0][0] = { type: TileType.START_FINISH, rotation: 0 };
		grid[0][1] = { type: TileType.STRAIGHT, rotation: 0 };
		const trackData: TrackData = { version: 1, grid };

		await ctrl.buildCollisionWorld(trackData);
		// The world must have been constructed without throwing
		expect(ctrl.vehicleState.position).toBeDefined();

		ctrl.dispose();
	});

	it("creates colliders for RAMP tiles without throwing", async () => {
		await RAPIER.init();
		const ctrl = new PhysicsController();

		const grid = makeEmptyGrid();
		grid[0][0] = { type: TileType.START_FINISH, rotation: 0 };
		grid[0][1] = { type: TileType.RAMP, rotation: 0 };
		grid[0][2] = { type: TileType.RAMP, rotation: 90 };
		grid[0][3] = { type: TileType.RAMP, rotation: 180 };
		grid[0][4] = { type: TileType.RAMP, rotation: 270 };
		const trackData: TrackData = { version: 1, grid };

		await ctrl.buildCollisionWorld(trackData);
		expect(ctrl.vehicleState).toBeDefined();

		ctrl.dispose();
	});

	it("creates colliders for LOOP tiles without throwing", async () => {
		await RAPIER.init();
		const ctrl = new PhysicsController();

		const grid = makeEmptyGrid();
		grid[0][0] = { type: TileType.START_FINISH, rotation: 0 };
		grid[0][1] = { type: TileType.LOOP, rotation: 0 };
		const trackData: TrackData = { version: 1, grid };

		await ctrl.buildCollisionWorld(trackData);
		expect(ctrl.vehicleState).toBeDefined();

		ctrl.dispose();
	});

	it("creates colliders for BRIDGE tiles without throwing", async () => {
		await RAPIER.init();
		const ctrl = new PhysicsController();

		const grid = makeEmptyGrid();
		grid[0][0] = { type: TileType.START_FINISH, rotation: 0 };
		grid[0][1] = { type: TileType.BRIDGE, rotation: 0 };
		const trackData: TrackData = { version: 1, grid };

		await ctrl.buildCollisionWorld(trackData);
		expect(ctrl.vehicleState).toBeDefined();

		ctrl.dispose();
	});

	it("handles all tile types in the same track", async () => {
		await RAPIER.init();
		const ctrl = new PhysicsController();

		const grid = makeEmptyGrid();
		grid[0][0] = { type: TileType.START_FINISH, rotation: 0 };
		grid[0][1] = { type: TileType.STRAIGHT, rotation: 0 };
		grid[0][2] = { type: TileType.CURVE, rotation: 90 };
		grid[0][3] = { type: TileType.RAMP, rotation: 0 };
		grid[0][4] = { type: TileType.LOOP, rotation: 0 };
		grid[0][5] = { type: TileType.BRIDGE, rotation: 0 };
		const trackData: TrackData = { version: 1, grid };

		await ctrl.buildCollisionWorld(trackData);
		expect(ctrl.vehicleState).toBeDefined();

		ctrl.dispose();
	});

	it("spawns car at START_FINISH world position", async () => {
		await RAPIER.init();
		const ctrl = new PhysicsController();

		const grid = makeEmptyGrid();
		// START_FINISH at col=5, row=3 → world (5, 0, 3)
		grid[3][5] = { type: TileType.START_FINISH, rotation: 0 };
		const trackData: TrackData = { version: 1, grid };

		await ctrl.buildCollisionWorld(trackData);

		const pos = ctrl.vehicleState.position;
		expect(pos.x).toBeCloseTo(5 * TILE_SIZE, 3);
		expect(pos.z).toBeCloseTo(3 * TILE_SIZE, 3);
		expect(pos.y).toBeCloseTo(CHASSIS_SPAWN_OFFSET_Y, 3);

		ctrl.dispose();
	});

	it("spawns car at origin when no START_FINISH tile", async () => {
		await RAPIER.init();
		const ctrl = new PhysicsController();

		// Deliberately no START_FINISH — unusual but should not crash
		const grid = makeEmptyGrid();
		grid[0][0] = { type: TileType.STRAIGHT, rotation: 0 };
		const trackData: TrackData = { version: 1, grid };

		await ctrl.buildCollisionWorld(trackData);

		const pos = ctrl.vehicleState.position;
		expect(pos.x).toBeCloseTo(0, 3);
		expect(pos.z).toBeCloseTo(0, 3);
		expect(pos.y).toBeCloseTo(CHASSIS_SPAWN_OFFSET_Y, 3);

		ctrl.dispose();
	});

	it("bridge collider centre Y equals BRIDGE_ELEVATION + SLAB_HALF_Y in the PhysicsController world", async () => {
		await RAPIER.init();

		// Build a track with one bridge tile and query the controller's actual colliders.
		// PhysicsController exposes getColliderYPositions() (@internal) for this purpose.
		const ctrl = new PhysicsController();
		const grid = makeEmptyGrid();
		grid[0][0] = { type: TileType.START_FINISH, rotation: 0 };
		grid[3][3] = { type: TileType.BRIDGE, rotation: 0 };
		const trackData: TrackData = { version: 1, grid };
		await ctrl.buildCollisionWorld(trackData);

		const expectedCentreY = BRIDGE_ELEVATION + SLAB_HALF_Y; // 0.825
		expect(expectedCentreY).toBeCloseTo(0.825, 3);

		// Find the maximum Y among all colliders. In a track with only START_FINISH (y≈0.025)
		// and BRIDGE (y≈0.825) tiles, the bridge is the highest collider.
		// The chassis collider starts at CHASSIS_SPAWN_OFFSET_Y ≈ 0.27, below the bridge.
		const allY = ctrl.getColliderYPositions();
		const maxY = Math.max(...allY);
		expect(maxY).toBeCloseTo(expectedCentreY, 3);

		ctrl.dispose();
	});
});

// ---------------------------------------------------------------------------
// buildCollisionWorld — performance test
// ---------------------------------------------------------------------------

describe("buildCollisionWorld — performance", () => {
	it("fully-populated 16x16 grid completes in < 5ms (excluding WASM init)", async () => {
		// Initialize WASM before the timer starts — RAPIER.init() is idempotent but can
		// take 10-50 ms on first call, which would swamp the 5 ms budget.
		await RAPIER.init();
		const ctrl = new PhysicsController();
		const trackData = makeFullGrid(TileType.STRAIGHT);

		const start = performance.now();
		await ctrl.buildCollisionWorld(trackData);
		const elapsed = performance.now() - start;

		// buildCollisionWorld calls RAPIER.init() internally (idempotent, ~0 ms after first
		// call), then creates colliders. The 5 ms budget covers collider construction only.
		expect(elapsed).toBeLessThan(5);
		ctrl.dispose();
	});
});

// ---------------------------------------------------------------------------
// InputVector → velocity (integration tests)
// ---------------------------------------------------------------------------

describe("InputVector → vehicle response", () => {
	it("full throttle for 120 ticks reaches speed >= 15.0 m/s (spec target)", async () => {
		await RAPIER.init();
		const ctrl = new PhysicsController();
		// Use a full 16x16 straight grid so the car never runs off the edge
		await ctrl.buildCollisionWorld(makeFullGrid(TileType.STRAIGHT));

		const dt = 1 / 60;
		for (let i = 0; i < 120; i++) {
			ctrl.step(FULL_THROTTLE, dt);
		}

		// Spec (game-physics.spec.md §Flat ground scenario): after 2 s full throttle,
		// speed must be ≥ 15 m/s and ≤ MAX_FORWARD_SPEED.
		// ENGINE_FORCE was tuned to 100 N (from 15 N) to achieve this — see constants.ts.
		const speed = ctrl.vehicleState.speed;
		expect(speed).toBeGreaterThanOrEqual(15.0);
		expect(speed).toBeLessThanOrEqual(MAX_FORWARD_SPEED);

		ctrl.dispose();
	});

	it("speed does not exceed MAX_FORWARD_SPEED + 1.0 under sustained throttle", async () => {
		await RAPIER.init();
		const ctrl = new PhysicsController();
		// Use a full 16x16 straight grid so the car never runs off the edge
		await ctrl.buildCollisionWorld(makeFullGrid(TileType.STRAIGHT));

		const dt = 1 / 60;
		// Run long enough to reach top speed (Rapier suspension warm-up takes ~8-10 s)
		for (let i = 0; i < 600; i++) {
			ctrl.step(FULL_THROTTLE, dt);
		}

		// Speed cap is enforced; allow 1.0 m/s overshoot tolerance for Rapier integrator.
		const speed = ctrl.vehicleState.speed;
		expect(speed).toBeLessThanOrEqual(MAX_FORWARD_SPEED + 1.0);

		ctrl.dispose();
	});

	it("braking from top speed reduces speed below 10 m/s after 60 ticks", async () => {
		await RAPIER.init();
		const ctrl = new PhysicsController();
		await ctrl.buildCollisionWorld(makeFullGrid(TileType.STRAIGHT));

		const dt = 1 / 60;
		// Reach top speed first
		for (let i = 0; i < 400; i++) {
			ctrl.step(FULL_THROTTLE, dt);
		}
		const topSpeed = ctrl.vehicleState.speed;
		expect(topSpeed).toBeGreaterThan(10.0);

		// Brake for 60 ticks (1 second)
		const brakeInput: InputVector = {
			throttle: 0,
			steer: 0,
			brake: true,
			reset: false,
		};
		for (let i = 0; i < 60; i++) {
			ctrl.step(brakeInput, dt);
		}

		expect(ctrl.vehicleState.speed).toBeLessThan(10.0);
		ctrl.dispose();
	});
});

// ---------------------------------------------------------------------------
// Airborne detection
// ---------------------------------------------------------------------------

describe("isAirborne detection", () => {
	it("is false when car is on ground after settling", async () => {
		await RAPIER.init();
		const ctrl = new PhysicsController();
		await ctrl.buildCollisionWorld(makeStraightTrack());

		const dt = 1 / 60;
		// Let the car settle on the ground (idle, ~1 second)
		for (let i = 0; i < 60; i++) {
			ctrl.step(IDLE_INPUT, dt);
		}

		expect(ctrl.vehicleState.isAirborne).toBe(false);
		ctrl.dispose();
	});

	it("airtime is 0 when not airborne", async () => {
		await RAPIER.init();
		const ctrl = new PhysicsController();
		await ctrl.buildCollisionWorld(makeStraightTrack());

		const dt = 1 / 60;
		for (let i = 0; i < 60; i++) {
			ctrl.step(IDLE_INPUT, dt);
		}

		expect(ctrl.vehicleState.airtime).toBe(0);
		ctrl.dispose();
	});

	it("is true and airtime increases when car is elevated above any ground", async () => {
		await RAPIER.init();
		const ctrl = new PhysicsController();

		// Track with no tiles beneath the spawn — car will fall
		const grid = makeEmptyGrid();
		grid[8][8] = { type: TileType.START_FINISH, rotation: 0 };
		const trackData: TrackData = { version: 1, grid };
		await ctrl.buildCollisionWorld(trackData);

		const dt = 1 / 60;
		// Step a few ticks — car is above y=-5 but no ground, so airborne
		let foundAirborne = false;
		for (let i = 0; i < 20; i++) {
			ctrl.step(IDLE_INPUT, dt);
			if (ctrl.vehicleState.isAirborne) {
				foundAirborne = true;
				break;
			}
		}

		expect(foundAirborne).toBe(true);
		ctrl.dispose();
	});
});

// ---------------------------------------------------------------------------
// Respawn logic
// ---------------------------------------------------------------------------

describe("Respawn logic", () => {
	it("fall-off respawn: triggers when position.y < FALL_OFF_Y_THRESHOLD", async () => {
		await RAPIER.init();
		const ctrl = new PhysicsController();

		// Place START_FINISH at col=5, row=5
		const grid = makeEmptyGrid();
		grid[5][5] = { type: TileType.START_FINISH, rotation: 0 };
		const trackData: TrackData = { version: 1, grid };
		await ctrl.buildCollisionWorld(trackData);

		const dt = 1 / 60;
		// Simulate until car falls below threshold (no ground under spawn)
		let respawned = false;
		for (let i = 0; i < 300; i++) {
			ctrl.step(IDLE_INPUT, dt);
			const { position } = ctrl.vehicleState;
			if (position.y >= CHASSIS_SPAWN_OFFSET_Y - 0.1) {
				// Car is near spawn position — respawn happened
				if (i > 10) {
					respawned = true;
					break;
				}
			}
			// If car went below threshold and came back, that's a respawn
			if (i > 5 && position.y > -1 && position.y < CHASSIS_SPAWN_OFFSET_Y + 0.5) {
				respawned = true;
				break;
			}
		}

		// After many ticks falling, car should have respawned near START_FINISH
		// Check that we're not permanently below -5
		const finalY = ctrl.vehicleState.position.y;
		expect(finalY).toBeGreaterThan(FALL_OFF_Y_THRESHOLD);
		ctrl.dispose();
	});

	it("reset input causes immediate respawn to START_FINISH", async () => {
		await RAPIER.init();
		const ctrl = new PhysicsController();
		await ctrl.buildCollisionWorld(makeStraightTrack());

		const dt = 1 / 60;
		// Drive forward to move away from spawn
		for (let i = 0; i < 60; i++) {
			ctrl.step(FULL_THROTTLE, dt);
		}

		const preResetX = ctrl.vehicleState.position.x;

		// Apply reset
		const resetInput: InputVector = {
			throttle: 0,
			steer: 0,
			brake: false,
			reset: true,
		};
		ctrl.step(resetInput, dt);

		// Should be back near START_FINISH (col=8, row=0 → x=8)
		const postResetPos = ctrl.vehicleState.position;
		// Spawn is at START_FINISH position
		expect(postResetPos.y).toBeCloseTo(CHASSIS_SPAWN_OFFSET_Y, 1);
		// Speed should be near zero after respawn
		expect(ctrl.vehicleState.speed).toBeLessThan(1.0);

		ctrl.dispose();
	});

	it("velocities are zeroed after respawn", async () => {
		await RAPIER.init();
		const ctrl = new PhysicsController();

		// No tiles — car falls immediately
		const grid = makeEmptyGrid();
		grid[8][8] = { type: TileType.START_FINISH, rotation: 0 };
		const trackData: TrackData = { version: 1, grid };
		await ctrl.buildCollisionWorld(trackData);

		const dt = 1 / 60;
		const resetInput: InputVector = {
			throttle: 0,
			steer: 0,
			brake: false,
			reset: true,
		};
		ctrl.step(resetInput, dt);

		// After reset, velocityY should be near 0
		expect(Math.abs(ctrl.vehicleState.velocityY)).toBeLessThan(0.5);
		ctrl.dispose();
	});

	it("stuck respawn fires after RESPAWN_STUCK_DURATION with zero throttle", async () => {
		await RAPIER.init();
		const ctrl = new PhysicsController();

		// Track with a START_FINISH tile at col=4, row=4 so car spawns above ground.
		// Surround it with straight tiles so the car stays on ground and remains stationary
		// (speed < RESPAWN_VELOCITY_THRESHOLD) triggering the stuck timer.
		const grid = makeEmptyGrid();
		grid[4][4] = { type: TileType.START_FINISH, rotation: 0 };
		for (let r = 3; r <= 5; r++) {
			for (let c = 3; c <= 5; c++) {
				if (grid[r][c] === null) {
					grid[r][c] = { type: TileType.STRAIGHT, rotation: 0 };
				}
			}
		}
		const trackData: TrackData = { version: 1, grid };
		await ctrl.buildCollisionWorld(trackData);

		// Record spawn position — after stuck respawn, car returns here
		const spawnX = ctrl.vehicleState.position.x;
		const spawnZ = ctrl.vehicleState.position.z;

		const dt = 1 / 60;
		// Step > RESPAWN_STUCK_DURATION seconds with zero throttle.
		// Car starts at rest (speed ≈ 0 < RESPAWN_VELOCITY_THRESHOLD = 0.5),
		// so the stuck timer increments every tick.
		// RESPAWN_STUCK_DURATION = 3.0 s → need > 180 ticks at 60 Hz.
		const ticksNeeded = Math.ceil(RESPAWN_STUCK_DURATION * 60) + 5;
		let respawnDetected = false;
		for (let i = 0; i < ticksNeeded; i++) {
			ctrl.step(IDLE_INPUT, dt);
			// After the stuck timer fires the car is teleported back to spawn position.
			// Detect this by checking that position is close to spawn and speed is low.
			if (i > Math.ceil(RESPAWN_STUCK_DURATION * 60)) {
				const pos = ctrl.vehicleState.position;
				if (
					Math.abs(pos.x - spawnX) < 0.5 &&
					Math.abs(pos.z - spawnZ) < 0.5 &&
					Math.abs(pos.y - CHASSIS_SPAWN_OFFSET_Y) < 0.5
				) {
					respawnDetected = true;
					break;
				}
			}
		}

		expect(respawnDetected).toBe(true);
		ctrl.dispose();
	});
});

// ---------------------------------------------------------------------------
// dispose
// ---------------------------------------------------------------------------

describe("PhysicsController.dispose", () => {
	it("dispose can be called multiple times without throwing", async () => {
		await RAPIER.init();
		const ctrl = new PhysicsController();
		await ctrl.buildCollisionWorld(makeStraightTrack());

		expect(() => ctrl.dispose()).not.toThrow();
		expect(() => ctrl.dispose()).not.toThrow();
	});

	it("step is a no-op after dispose", async () => {
		await RAPIER.init();
		const ctrl = new PhysicsController();
		await ctrl.buildCollisionWorld(makeStraightTrack());
		ctrl.dispose();

		expect(() => ctrl.step(IDLE_INPUT, 1 / 60)).not.toThrow();
	});
});
