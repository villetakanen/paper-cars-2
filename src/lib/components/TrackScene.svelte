<script lang="ts">
import { Canvas } from "@threlte/core";
import { gridStore } from "../grid";
import CameraRig from "./CameraRig.svelte";
import Environment from "./Environment.svelte";
import TileMesh from "./TileMesh.svelte";
</script>

<Canvas>
	<Environment />
	<CameraRig mode="editor" />

	{#each gridStore.grid as row, z}
		{#each row as cell, x}
			{#if cell}
				{#key cell.type}
					<TileMesh
						tileType={cell.type}
						rotation={cell.rotation}
						gridX={x}
						gridZ={z}
					/>
				{/key}
			{/if}
		{/each}
	{/each}
</Canvas>

<style>
	:global(canvas) {
		display: block;
		width: 100% !important;
		height: 100% !important;
	}
</style>
