<script lang="ts">
import { T, useTask } from "@threlte/core";
import { OrbitControls } from "@threlte/extras";
import { driveController } from "../stores/driveController.svelte";
import {
	CHASE_DISTANCE,
	CHASE_HEIGHT,
	CHASE_LOOK_AHEAD,
	CHASE_LOOK_SMOOTHING,
	CHASE_SMOOTHING,
	GRID_SIZE,
	TILE_SIZE,
} from "./constants";

interface Props {
	mode?: "editor" | "drive";
}

let { mode = "editor" }: Props = $props();

// Grid center in world space
const centerX = (GRID_SIZE * TILE_SIZE) / 2;
const centerZ = (GRID_SIZE * TILE_SIZE) / 2;

// Chase camera state
let cameraPos = $state({ x: centerX, y: 10, z: centerZ + 15 });
let lookAtTarget = $state({ x: centerX, y: 0, z: centerZ });

// Camera ref captured via oncreate — typed minimally to avoid needing @types/three
let cameraObj: { lookAt: (x: number, y: number, z: number) => void } | null =
	null;

/**
 * Extract forward vector (0,0,-1) rotated by a quaternion.
 * Avoids importing THREE just for quaternion math.
 */
function forwardFromQuat(q: { x: number; y: number; z: number; w: number }): {
	x: number;
	z: number;
} {
	// Rotate (0,0,-1) by quaternion: v' = q * v * q^-1
	// Simplified for unit vector (0,0,-1):
	const x = -(2 * (q.x * q.z + q.w * q.y));
	const z = -(1 - 2 * (q.x * q.x + q.y * q.y));
	return { x, z };
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

useTask(() => {
	if (mode !== "drive") return;

	const state = driveController.vehicleState;
	const forward = forwardFromQuat(state.rotation);

	// Target camera position: behind and above the car
	const targetX = state.position.x - forward.x * CHASE_DISTANCE;
	const targetY = state.position.y + CHASE_HEIGHT;
	const targetZ = state.position.z - forward.z * CHASE_DISTANCE;

	// Target look position: ahead of the car
	const lookX = state.position.x + forward.x * CHASE_LOOK_AHEAD;
	const lookY = state.position.y + 0.5;
	const lookZ = state.position.z + forward.z * CHASE_LOOK_AHEAD;

	// Smooth interpolation
	cameraPos = {
		x: lerp(cameraPos.x, targetX, CHASE_SMOOTHING),
		y: lerp(cameraPos.y, targetY, CHASE_SMOOTHING),
		z: lerp(cameraPos.z, targetZ, CHASE_SMOOTHING),
	};

	lookAtTarget = {
		x: lerp(lookAtTarget.x, lookX, CHASE_LOOK_SMOOTHING),
		y: lerp(lookAtTarget.y, lookY, CHASE_LOOK_SMOOTHING),
		z: lerp(lookAtTarget.z, lookZ, CHASE_LOOK_SMOOTHING),
	};

	// Update camera orientation every frame
	if (cameraObj) {
		cameraObj.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z);
	}
});
</script>

{#if mode === "editor"}
	<T.PerspectiveCamera
		makeDefault
		position={[centerX + 12, 15, centerZ + 12]}
		fov={50}
	>
		<OrbitControls target={[centerX, 0, centerZ]} enableDamping />
	</T.PerspectiveCamera>
{:else}
	<T.PerspectiveCamera
		makeDefault
		position={[cameraPos.x, cameraPos.y, cameraPos.z]}
		fov={60}
		oncreate={(ref) => {
			cameraObj = ref;
		}}
	/>
{/if}
