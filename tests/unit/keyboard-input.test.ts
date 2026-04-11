import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { keyboardInput } from "../../src/lib/input/keyboard.svelte";

// Mock window event listeners for non-browser test environment
const listeners: Record<string, ((e: Partial<KeyboardEvent>) => void)[]> = {};

function mockAddEventListener(
	type: string,
	fn: (e: Partial<KeyboardEvent>) => void,
): void {
	if (!listeners[type]) listeners[type] = [];
	listeners[type].push(fn);
}

function mockRemoveEventListener(
	type: string,
	fn: (e: Partial<KeyboardEvent>) => void,
): void {
	if (listeners[type]) {
		listeners[type] = listeners[type].filter((f) => f !== fn);
	}
}

function fireKey(type: "keydown" | "keyup", key: string): void {
	const event = { key, preventDefault: vi.fn() };
	for (const fn of listeners[type] ?? []) {
		fn(event);
	}
}

beforeEach(() => {
	for (const key of Object.keys(listeners)) {
		delete listeners[key];
	}
	vi.stubGlobal(
		"window",
		Object.assign({}, globalThis.window ?? {}, {
			addEventListener: mockAddEventListener,
			removeEventListener: mockRemoveEventListener,
		}),
	);
});

afterEach(() => {
	keyboardInput.detach();
	vi.unstubAllGlobals();
});

describe("KeyboardInput — key mappings", () => {
	it("defaults to zero input", () => {
		expect(keyboardInput.input).toEqual({
			throttle: 0,
			steer: 0,
			brake: false,
			reset: false,
		});
	});

	it("W key sets throttle to 1", () => {
		keyboardInput.attach();
		fireKey("keydown", "w");
		expect(keyboardInput.input.throttle).toBe(1);
	});

	it("ArrowUp sets throttle to 1", () => {
		keyboardInput.attach();
		fireKey("keydown", "ArrowUp");
		expect(keyboardInput.input.throttle).toBe(1);
	});

	it("S key sets throttle to -1", () => {
		keyboardInput.attach();
		fireKey("keydown", "s");
		expect(keyboardInput.input.throttle).toBe(-1);
	});

	it("A key sets steer to -1 (left)", () => {
		keyboardInput.attach();
		fireKey("keydown", "a");
		expect(keyboardInput.input.steer).toBe(-1);
	});

	it("D key sets steer to 1 (right)", () => {
		keyboardInput.attach();
		fireKey("keydown", "d");
		expect(keyboardInput.input.steer).toBe(1);
	});

	it("Space sets brake to true", () => {
		keyboardInput.attach();
		fireKey("keydown", " ");
		expect(keyboardInput.input.brake).toBe(true);
	});

	it("R key sets reset to true", () => {
		keyboardInput.attach();
		fireKey("keydown", "r");
		expect(keyboardInput.input.reset).toBe(true);
	});

	it("releasing a key clears the input", () => {
		keyboardInput.attach();
		fireKey("keydown", "w");
		expect(keyboardInput.input.throttle).toBe(1);
		fireKey("keyup", "w");
		expect(keyboardInput.input.throttle).toBe(0);
	});
});

describe("KeyboardInput — opposing keys cancel", () => {
	it("W + S cancel throttle to 0", () => {
		keyboardInput.attach();
		fireKey("keydown", "w");
		fireKey("keydown", "s");
		expect(keyboardInput.input.throttle).toBe(0);
	});

	it("A + D cancel steer to 0", () => {
		keyboardInput.attach();
		fireKey("keydown", "a");
		fireKey("keydown", "d");
		expect(keyboardInput.input.steer).toBe(0);
	});

	it("releasing one opposing key restores direction", () => {
		keyboardInput.attach();
		fireKey("keydown", "w");
		fireKey("keydown", "s");
		expect(keyboardInput.input.throttle).toBe(0);
		fireKey("keyup", "s");
		expect(keyboardInput.input.throttle).toBe(1);
	});
});

describe("KeyboardInput — attach/detach lifecycle", () => {
	it("does not respond to keys before attach", () => {
		// No attach() call
		fireKey("keydown", "w");
		expect(keyboardInput.input.throttle).toBe(0);
	});

	it("stops responding after detach", () => {
		keyboardInput.attach();
		fireKey("keydown", "w");
		expect(keyboardInput.input.throttle).toBe(1);
		keyboardInput.detach();
		// Input resets on detach
		expect(keyboardInput.input.throttle).toBe(0);
	});

	it("clears held keys on detach", () => {
		keyboardInput.attach();
		fireKey("keydown", "w");
		fireKey("keydown", "a");
		keyboardInput.detach();
		expect(keyboardInput.input).toEqual({
			throttle: 0,
			steer: 0,
			brake: false,
			reset: false,
		});
	});
});
