<script lang="ts">
import { T } from "@threlte/core";
import { useGltf } from "@threlte/extras";
import { driveController } from "../stores/driveController.svelte";
import { VEHICLE_ASSET } from "./assets";

const gltf = useGltf(VEHICLE_ASSET);
</script>

{#if $gltf}
	<T.Group
		position={[
			driveController.vehicleState.position.x,
			driveController.vehicleState.position.y,
			driveController.vehicleState.position.z,
		]}
		quaternion={[
			driveController.vehicleState.rotation.x,
			driveController.vehicleState.rotation.y,
			driveController.vehicleState.rotation.z,
			driveController.vehicleState.rotation.w,
		]}
	>
		<T is={$gltf.scene.clone()} />
	</T.Group>
{/if}
