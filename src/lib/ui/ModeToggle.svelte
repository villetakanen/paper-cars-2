<script lang="ts">
import { gridStore } from "../grid";
import { driveController } from "../stores/driveController.svelte";
import { gameModeStore } from "../stores/gameMode.svelte";

async function enterDrive(): Promise<void> {
	const trackData = gridStore.getTrackData();
	await driveController.start(trackData);
	gameModeStore.current = "drive";
}

function exitDrive(): void {
	driveController.stop();
	gameModeStore.current = "editor";
}

function onKeyDown(e: KeyboardEvent): void {
	if (e.key === "Escape" && gameModeStore.current === "drive") {
		exitDrive();
	}
}
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="mode-toggle">
	{#if gameModeStore.current === "editor"}
		<button
			class="btn drive"
			disabled={!gridStore.isValid}
			onclick={enterDrive}
			title={gridStore.isValid ? "Start driving" : "Place a START_FINISH tile first"}
		>
			Drive
		</button>
	{:else}
		<button class="btn edit" onclick={exitDrive}>
			Edit
		</button>
	{/if}
</div>

<style>
	.mode-toggle {
		position: fixed;
		top: 16px;
		right: 16px;
		z-index: 20;
	}

	.btn {
		padding: 10px 24px;
		font-size: 1.1rem;
		font-weight: bold;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-family: inherit;
		transition: background 0.15s;
	}

	.btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.drive {
		background: #4caf50;
		color: white;
	}

	.drive:hover:not(:disabled) {
		background: #388e3c;
	}

	.edit {
		background: #ff9800;
		color: white;
	}

	.edit:hover {
		background: #f57c00;
	}
</style>
