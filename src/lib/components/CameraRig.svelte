<script lang="ts">
import { T } from "@threlte/core";
import { OrbitControls } from "@threlte/extras";
import { GRID_SIZE, TILE_SIZE } from "./constants";

interface Props {
	mode?: "editor" | "drive";
}

let { mode = "editor" }: Props = $props();

// Grid center in world space
const centerX = (GRID_SIZE * TILE_SIZE) / 2;
const centerZ = (GRID_SIZE * TILE_SIZE) / 2;
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
	<!-- Drive mode: static camera placeholder for Epic 5 -->
	<T.PerspectiveCamera
		makeDefault
		position={[centerX, 10, centerZ + 15]}
		fov={60}
	/>
{/if}
