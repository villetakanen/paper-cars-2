import { describe, expect, it } from "vitest";
import { gameModeStore } from "../../src/lib/stores/gameMode.svelte";

describe("GameModeStore", () => {
	it("initializes to editor mode", () => {
		expect(gameModeStore.current).toBe("editor");
	});

	it("can transition to drive mode", () => {
		gameModeStore.current = "drive";
		expect(gameModeStore.current).toBe("drive");
		// Reset for other tests
		gameModeStore.current = "editor";
	});

	it("can transition back to editor mode", () => {
		gameModeStore.current = "drive";
		gameModeStore.current = "editor";
		expect(gameModeStore.current).toBe("editor");
	});
});
