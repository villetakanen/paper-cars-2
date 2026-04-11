<script lang="ts">
import { T } from "@threlte/core";
import { GRID_SIZE, TILE_SIZE } from "./constants";

const groundSize = GRID_SIZE * TILE_SIZE + 4; // extend slightly beyond the grid
const centerX = (GRID_SIZE * TILE_SIZE) / 2;
const centerZ = (GRID_SIZE * TILE_SIZE) / 2;
</script>

<!-- Ground plane: cardboard/paper colour, rotated to lie flat on XZ -->
<T.Mesh rotation.x={-Math.PI / 2} position={[centerX, -0.01, centerZ]}>
	<T.PlaneGeometry args={[groundSize, groundSize]} />
	<T.MeshStandardMaterial color="#c4a882" roughness={1} metalness={0} />
</T.Mesh>

<!-- Directional light: desk-lamp style, warm white -->
<T.DirectionalLight position={[centerX + 5, 15, centerZ + 5]} intensity={2} color="#fff8f0" />

<!-- Ambient light: soft warm fill so no area is fully dark -->
<T.AmbientLight intensity={0.4} color="#ffeedd" />
