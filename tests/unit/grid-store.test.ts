import { beforeEach, describe, expect, it } from "vitest";
import { gridStore } from "../../src/lib/grid/index";
import { TileType } from "../../src/lib/types/track";

beforeEach(() => {
	gridStore.clearGrid();
});

describe("Grid Store — basic placement", () => {
	it("initializes to a 16x16 grid of nulls", () => {
		expect(gridStore.grid.length).toBe(16);
		for (const row of gridStore.grid) {
			expect(row.length).toBe(16);
			for (const cell of row) {
				expect(cell).toBeNull();
			}
		}
	});

	it("places a tile at the correct position", () => {
		gridStore.placeTile(3, 5, TileType.STRAIGHT, 90);
		expect(gridStore.grid[5][3]).toEqual({
			type: TileType.STRAIGHT,
			rotation: 90,
		});
	});

	it("overwrites an existing tile", () => {
		gridStore.placeTile(1, 1, TileType.STRAIGHT, 0);
		gridStore.placeTile(1, 1, TileType.CURVE, 180);
		expect(gridStore.grid[1][1]).toEqual({
			type: TileType.CURVE,
			rotation: 180,
		});
	});

	it("places tiles at all four corners", () => {
		gridStore.placeTile(0, 0, TileType.STRAIGHT, 0);
		gridStore.placeTile(15, 0, TileType.CURVE, 90);
		gridStore.placeTile(0, 15, TileType.RAMP, 180);
		gridStore.placeTile(15, 15, TileType.BRIDGE, 270);
		expect(gridStore.grid[0][0]).toEqual({
			type: TileType.STRAIGHT,
			rotation: 0,
		});
		expect(gridStore.grid[0][15]).toEqual({
			type: TileType.CURVE,
			rotation: 90,
		});
		expect(gridStore.grid[15][0]).toEqual({
			type: TileType.RAMP,
			rotation: 180,
		});
		expect(gridStore.grid[15][15]).toEqual({
			type: TileType.BRIDGE,
			rotation: 270,
		});
	});
});

describe("Grid Store — removal", () => {
	it("removes a tile", () => {
		gridStore.placeTile(4, 4, TileType.LOOP, 0);
		gridStore.removeTile(4, 4);
		expect(gridStore.grid[4][4]).toBeNull();
	});

	it("removeTile on an empty cell is a no-op", () => {
		expect(() => gridStore.removeTile(7, 7)).not.toThrow();
		expect(gridStore.grid[7][7]).toBeNull();
	});
});

describe("Grid Store — clearGrid", () => {
	it("resets all cells to null", () => {
		gridStore.placeTile(0, 0, TileType.STRAIGHT, 0);
		gridStore.placeTile(8, 8, TileType.CURVE, 90);
		gridStore.clearGrid();
		for (const row of gridStore.grid) {
			for (const cell of row) {
				expect(cell).toBeNull();
			}
		}
	});

	it("grid remains 16x16 after clear", () => {
		gridStore.clearGrid();
		expect(gridStore.grid.length).toBe(16);
		for (const row of gridStore.grid) {
			expect(row.length).toBe(16);
		}
	});
});

describe("Grid Store — boundary enforcement", () => {
	it("placeTile with x=16 is a silent no-op", () => {
		gridStore.placeTile(16, 0, TileType.STRAIGHT, 0);
		for (const row of gridStore.grid) {
			for (const cell of row) {
				expect(cell).toBeNull();
			}
		}
	});

	it("placeTile with z=16 is a silent no-op", () => {
		gridStore.placeTile(0, 16, TileType.STRAIGHT, 0);
		for (const row of gridStore.grid) {
			for (const cell of row) {
				expect(cell).toBeNull();
			}
		}
	});

	it("placeTile with negative coordinates is a silent no-op", () => {
		gridStore.placeTile(-1, 5, TileType.STRAIGHT, 0);
		gridStore.placeTile(5, -1, TileType.STRAIGHT, 0);
		for (const row of gridStore.grid) {
			for (const cell of row) {
				expect(cell).toBeNull();
			}
		}
	});

	it("removeTile out of bounds is a silent no-op", () => {
		expect(() => gridStore.removeTile(16, 16)).not.toThrow();
		expect(() => gridStore.removeTile(-1, -1)).not.toThrow();
	});
});

describe("Grid Store — immutability", () => {
	it("mutating the returned grid does not affect internal state", () => {
		gridStore.placeTile(3, 3, TileType.STRAIGHT, 0);
		const snapshot = gridStore.grid;
		// Mutate the returned copy
		snapshot[3][3] = null;
		// Internal state must be unchanged
		expect(gridStore.grid[3][3]).toEqual({
			type: TileType.STRAIGHT,
			rotation: 0,
		});
	});
});

describe("Grid Store — START_FINISH singularity", () => {
	it("placing START_FINISH removes the existing one (Gherkin scenario 1)", () => {
		gridStore.placeTile(2, 2, TileType.START_FINISH, 0);
		expect(gridStore.grid[2][2]).toEqual({
			type: TileType.START_FINISH,
			rotation: 0,
		});

		gridStore.placeTile(5, 5, TileType.START_FINISH, 90);
		expect(gridStore.grid[5][5]).toEqual({
			type: TileType.START_FINISH,
			rotation: 90,
		});
		expect(gridStore.grid[2][2]).toBeNull();
	});

	it("only one START_FINISH exists at any time", () => {
		gridStore.placeTile(0, 0, TileType.START_FINISH, 0);
		gridStore.placeTile(15, 15, TileType.START_FINISH, 0);

		let count = 0;
		for (const row of gridStore.grid) {
			for (const cell of row) {
				if (cell?.type === TileType.START_FINISH) count++;
			}
		}
		expect(count).toBe(1);
	});

	it("non-START_FINISH tiles do not trigger singularity removal", () => {
		gridStore.placeTile(0, 0, TileType.START_FINISH, 0);
		gridStore.placeTile(1, 1, TileType.STRAIGHT, 0);
		expect(gridStore.grid[0][0]).toEqual({
			type: TileType.START_FINISH,
			rotation: 0,
		});
	});
});
