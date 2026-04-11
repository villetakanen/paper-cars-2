/**
 * Drive Controller — orchestrates PhysicsController lifecycle and game loop.
 * Bridges UI-level mode toggle and the Physics Controller's imperative API.
 * Spec: specs/drive-mode/spec.md
 */

import RAPIER from "@dimforge/rapier3d-compat";
import { keyboardInput } from "../input/keyboard.svelte";
import { PHYSICS_TIMESTEP } from "../physics/constants";
import { PhysicsController } from "../physics/controller.svelte";
import type { InputVector, VehicleState } from "../physics/types";
import type { TrackData } from "../types/track";

const DEFAULT_VEHICLE_STATE: VehicleState = {
	position: { x: 0, y: 0, z: 0 },
	rotation: { x: 0, y: 0, z: 0, w: 1 },
	speed: 0,
	velocityY: 0,
	isAirborne: false,
	airtime: 0,
	angularVelocity: { x: 0, y: 0, z: 0 },
};

/** Maximum physics steps per frame to prevent spiral-of-death on long frames. */
const MAX_STEPS_PER_FRAME = 4;

class DriveController {
	private physics: PhysicsController | null = null;
	private animFrameId = 0;
	private lastTime = 0;
	private accumulator = 0;

	isRunning: boolean = $state(false);
	vehicleState: VehicleState = $state({ ...DEFAULT_VEHICLE_STATE });
	elapsed: number = $state(0);

	async start(trackData: TrackData): Promise<void> {
		// Clean up any previous session
		this.stop();

		await RAPIER.init();

		this.physics = new PhysicsController();
		await this.physics.buildCollisionWorld(trackData);

		this.elapsed = 0;
		this.accumulator = 0;
		this.lastTime = performance.now();
		this.isRunning = true;

		keyboardInput.attach();
		this.loop();
	}

	stop(): void {
		this.isRunning = false;
		keyboardInput.detach();

		if (this.animFrameId) {
			cancelAnimationFrame(this.animFrameId);
			this.animFrameId = 0;
		}

		if (this.physics) {
			this.physics.dispose();
			this.physics = null;
		}

		this.vehicleState = { ...DEFAULT_VEHICLE_STATE };
	}

	private loop(): void {
		if (!this.isRunning || !this.physics) return;

		this.animFrameId = requestAnimationFrame(() => {
			const now = performance.now();
			const frameDelta = (now - this.lastTime) / 1000;
			this.lastTime = now;

			if (!this.physics) return;

			// Clamp frame delta to prevent spiral of death on tab-switch
			const clampedDelta = Math.min(
				frameDelta,
				MAX_STEPS_PER_FRAME * PHYSICS_TIMESTEP,
			);
			this.accumulator += clampedDelta;

			// Fixed-timestep loop: step physics at exactly PHYSICS_TIMESTEP intervals
			const input: InputVector = keyboardInput.input;
			let steps = 0;
			while (
				this.accumulator >= PHYSICS_TIMESTEP &&
				steps < MAX_STEPS_PER_FRAME
			) {
				this.physics.step(input, PHYSICS_TIMESTEP);
				this.accumulator -= PHYSICS_TIMESTEP;
				steps++;
			}

			// Forward physics state to our reactive store
			const ps = this.physics.vehicleState;
			this.vehicleState = {
				position: { ...ps.position },
				rotation: { ...ps.rotation },
				speed: ps.speed,
				velocityY: ps.velocityY,
				isAirborne: ps.isAirborne,
				airtime: ps.airtime,
				angularVelocity: { ...ps.angularVelocity },
			};

			this.elapsed += clampedDelta;

			this.loop();
		});
	}
}

export const driveController = new DriveController();
