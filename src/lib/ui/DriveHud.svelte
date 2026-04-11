<script lang="ts">
import { driveController } from "../stores/driveController.svelte";

function formatSpeed(mps: number): string {
	return Math.round(mps * 3.6).toString();
}

function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	const whole = Math.floor(secs);
	const ms = Math.floor((secs - whole) * 100);
	return `${mins.toString().padStart(2, "0")}:${whole.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}
</script>

<div class="hud">
	<div class="speed">
		<span class="value">{formatSpeed(driveController.vehicleState.speed)}</span>
		<span class="unit">km/h</span>
	</div>

	<div class="timer">
		{formatTime(driveController.elapsed)}
	</div>

	<div class="pos">
		x:{driveController.vehicleState.position.x.toFixed(1)}
		y:{driveController.vehicleState.position.y.toFixed(1)}
		z:{driveController.vehicleState.position.z.toFixed(1)}
	</div>

	{#if driveController.vehicleState.isAirborne}
		<div class="airborne">AIRBORNE!</div>
	{/if}
</div>

<style>
	.hud {
		position: fixed;
		bottom: 20px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 24px;
		align-items: flex-end;
		font-family: monospace;
		pointer-events: none;
		z-index: 10;
	}

	.speed {
		background: rgba(0, 0, 0, 0.6);
		color: white;
		padding: 8px 16px;
		border-radius: 8px;
		display: flex;
		align-items: baseline;
		gap: 4px;
	}

	.speed .value {
		font-size: 2rem;
		font-weight: bold;
	}

	.speed .unit {
		font-size: 0.9rem;
		opacity: 0.7;
	}

	.timer {
		background: rgba(0, 0, 0, 0.6);
		color: white;
		padding: 8px 16px;
		border-radius: 8px;
		font-size: 1.4rem;
	}

	.pos {
		background: rgba(0, 0, 0, 0.6);
		color: #aaa;
		padding: 8px 16px;
		border-radius: 8px;
		font-size: 0.9rem;
	}

	.airborne {
		position: fixed;
		top: 30%;
		left: 50%;
		transform: translateX(-50%);
		font-size: 2rem;
		font-weight: bold;
		color: #ffdd00;
		text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
		animation: pulse 0.5s ease-in-out infinite alternate;
	}

	@keyframes pulse {
		from { opacity: 0.7; transform: translateX(-50%) scale(1); }
		to { opacity: 1; transform: translateX(-50%) scale(1.1); }
	}
</style>
