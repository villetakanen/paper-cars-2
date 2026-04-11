<script lang="ts">
import { T } from "@threlte/core";
import { useGltf } from "@threlte/extras";
import type { Rotation, TileType } from "../types/track";
import { TILE_ASSETS } from "./assets";
import { TILE_SIZE } from "./constants";

interface Props {
	tileType: TileType;
	rotation: Rotation;
	gridX: number;
	gridZ: number;
}

let { tileType, rotation, gridX, gridZ }: Props = $props();

// useGltf requires a string URL at call-time, so tileType is intentionally
// captured once at mount. TileMesh instances are keyed by grid position, so
// when the tile type changes the parent recreates this component entirely.
const gltf = useGltf(TILE_ASSETS[tileType]);

const worldX = $derived(gridX * TILE_SIZE);
const worldZ = $derived(gridZ * TILE_SIZE);
const rotationRad = $derived((rotation * Math.PI) / 180);
</script>

{#if $gltf}
	<T.Group position={[worldX, 0, worldZ]} rotation.y={rotationRad}>
		<!-- Clone the scene to avoid shared geometry issues -->
		<T is={$gltf.scene.clone()} />
	</T.Group>
{/if}
