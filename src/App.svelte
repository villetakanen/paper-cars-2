<script>
import TrackScene from "./lib/components/TrackScene.svelte";
import { gameModeStore } from "./lib/stores/gameMode.svelte";
import DriveHud from "./lib/ui/DriveHud.svelte";
import ModeToggle from "./lib/ui/ModeToggle.svelte";
</script>

<main>
	<TrackScene />
	<ModeToggle />
	{#if gameModeStore.current === "drive"}
		<DriveHud />
	{/if}
</main>

<style>
	main {
		width: 100vw;
		height: 100vh;
		margin: 0;
		padding: 0;
		overflow: hidden;
	}
</style>
