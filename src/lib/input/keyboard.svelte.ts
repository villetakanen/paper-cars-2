/**
 * Keyboard input handler — maps key events to InputVector.
 * Active only during drive mode. Spec: specs/drive-mode/spec.md
 *
 * Key bindings:
 *   W / ArrowUp    → throttle forward
 *   S / ArrowDown  → throttle reverse
 *   A / ArrowLeft  → steer left
 *   D / ArrowRight → steer right
 *   Space          → brake
 *   R              → reset/respawn
 *   Escape         → exit drive mode (handled by consumer, not here)
 */

import type { InputVector } from "../physics/types";

/** Keys that map to forward throttle. */
const FORWARD_KEYS = new Set(["w", "W", "ArrowUp"]);
/** Keys that map to reverse throttle. */
const REVERSE_KEYS = new Set(["s", "S", "ArrowDown"]);
/** Keys that map to steer left. */
const LEFT_KEYS = new Set(["a", "A", "ArrowLeft"]);
/** Keys that map to steer right. */
const RIGHT_KEYS = new Set(["d", "D", "ArrowRight"]);
/** Keys that map to brake. */
const BRAKE_KEYS = new Set([" "]);
/** Keys that map to reset. */
const RESET_KEYS = new Set(["r", "R"]);

class KeyboardInput {
	input: InputVector = $state({
		throttle: 0,
		steer: 0,
		brake: false,
		reset: false,
	});

	private keys = new Set<string>();
	private onKeyDown: ((e: KeyboardEvent) => void) | null = null;
	private onKeyUp: ((e: KeyboardEvent) => void) | null = null;

	attach(): void {
		this.keys.clear();
		this.updateInput();

		this.onKeyDown = (e: KeyboardEvent) => {
			this.keys.add(e.key);
			this.updateInput();

			// Prevent default for game keys to avoid scrolling etc.
			if (
				FORWARD_KEYS.has(e.key) ||
				REVERSE_KEYS.has(e.key) ||
				LEFT_KEYS.has(e.key) ||
				RIGHT_KEYS.has(e.key) ||
				BRAKE_KEYS.has(e.key) ||
				RESET_KEYS.has(e.key)
			) {
				e.preventDefault();
			}
		};

		this.onKeyUp = (e: KeyboardEvent) => {
			this.keys.delete(e.key);
			this.updateInput();
		};

		window.addEventListener("keydown", this.onKeyDown);
		window.addEventListener("keyup", this.onKeyUp);
	}

	detach(): void {
		if (this.onKeyDown) window.removeEventListener("keydown", this.onKeyDown);
		if (this.onKeyUp) window.removeEventListener("keyup", this.onKeyUp);
		this.onKeyDown = null;
		this.onKeyUp = null;
		this.keys.clear();
		this.updateInput();
	}

	private updateInput(): void {
		const forward = this.isAnyPressed(FORWARD_KEYS);
		const reverse = this.isAnyPressed(REVERSE_KEYS);
		const left = this.isAnyPressed(LEFT_KEYS);
		const right = this.isAnyPressed(RIGHT_KEYS);

		// Opposing keys cancel
		let throttle = 0;
		if (forward && !reverse) throttle = 1;
		else if (reverse && !forward) throttle = -1;

		let steer = 0;
		if (left && !right) steer = -1;
		else if (right && !left) steer = 1;

		this.input = {
			throttle,
			steer,
			brake: this.isAnyPressed(BRAKE_KEYS),
			reset: this.isAnyPressed(RESET_KEYS),
		};
	}

	private isAnyPressed(keys: Set<string>): boolean {
		for (const key of keys) {
			if (this.keys.has(key)) return true;
		}
		return false;
	}
}

export const keyboardInput = new KeyboardInput();
