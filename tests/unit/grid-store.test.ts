import { beforeEach, describe, expect, it } from "vitest";
import { gridStore } from "../../src/lib/grid/index";
import { TileType, type TrackData } from "../../src/lib/types/track";

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

describe("Grid Store — rotateTile", () => {
	it("rotates a tile from 0 to 90", () => {
		gridStore.placeTile(0, 0, TileType.STRAIGHT, 0);
		gridStore.rotateTile(0, 0);
		expect(gridStore.grid[0][0]).toEqual({
			type: TileType.STRAIGHT,
			rotation: 90,
		});
	});

	it("rotates a tile from 90 to 180", () => {
		gridStore.placeTile(1, 1, TileType.STRAIGHT, 90);
		gridStore.rotateTile(1, 1);
		expect(gridStore.grid[1][1]).toEqual({
			type: TileType.STRAIGHT,
			rotation: 180,
		});
	});

	it("rotates a tile from 180 to 270", () => {
		gridStore.placeTile(2, 2, TileType.CURVE, 180);
		gridStore.rotateTile(2, 2);
		expect(gridStore.grid[2][2]).toEqual({
			type: TileType.CURVE,
			rotation: 270,
		});
	});

	it("wraps rotation from 270 back to 0 (Gherkin scenario: cycling rotation)", () => {
		gridStore.placeTile(0, 0, TileType.STRAIGHT, 270);
		gridStore.rotateTile(0, 0);
		expect(gridStore.grid[0][0]).toEqual({
			type: TileType.STRAIGHT,
			rotation: 0,
		});
	});

	it("rotateTile on an empty cell is a silent no-op", () => {
		expect(() => gridStore.rotateTile(5, 5)).not.toThrow();
		expect(gridStore.grid[5][5]).toBeNull();
	});

	it("rotateTile out of bounds is a silent no-op", () => {
		expect(() => gridStore.rotateTile(16, 0)).not.toThrow();
		expect(() => gridStore.rotateTile(0, 16)).not.toThrow();
		expect(() => gridStore.rotateTile(-1, 0)).not.toThrow();
	});

	it("does not change the tile type when rotating", () => {
		gridStore.placeTile(3, 3, TileType.RAMP, 0);
		gridStore.rotateTile(3, 3);
		expect(gridStore.grid[3][3]?.type).toBe(TileType.RAMP);
	});
});

describe("Grid Store — isValid", () => {
	it("returns false on an empty grid", () => {
		expect(gridStore.isValid).toBe(false);
	});

	it("returns false when only non-START_FINISH tiles exist", () => {
		gridStore.placeTile(0, 0, TileType.STRAIGHT, 0);
		gridStore.placeTile(1, 1, TileType.CURVE, 90);
		expect(gridStore.isValid).toBe(false);
	});

	it("returns true after placing exactly one START_FINISH (Gherkin: Validity State)", () => {
		gridStore.placeTile(0, 0, TileType.STRAIGHT, 0);
		expect(gridStore.isValid).toBe(false);
		gridStore.placeTile(5, 5, TileType.START_FINISH, 0);
		expect(gridStore.isValid).toBe(true);
	});

	it("returns false after removing the START_FINISH tile", () => {
		gridStore.placeTile(5, 5, TileType.START_FINISH, 0);
		expect(gridStore.isValid).toBe(true);
		gridStore.removeTile(5, 5);
		expect(gridStore.isValid).toBe(false);
	});

	it("returns true after moving START_FINISH to a new position", () => {
		gridStore.placeTile(2, 2, TileType.START_FINISH, 0);
		gridStore.placeTile(8, 8, TileType.START_FINISH, 0);
		expect(gridStore.isValid).toBe(true);
	});

	it("returns false after clearGrid", () => {
		gridStore.placeTile(0, 0, TileType.START_FINISH, 0);
		gridStore.clearGrid();
		expect(gridStore.isValid).toBe(false);
	});
});

describe("Grid Store — startPosition", () => {
	it("returns null on an empty grid", () => {
		expect(gridStore.startPosition).toBeNull();
	});

	it("returns [x, z] after placing a START_FINISH tile", () => {
		gridStore.placeTile(3, 7, TileType.START_FINISH, 0);
		expect(gridStore.startPosition).toEqual([3, 7]);
	});

	it("updates when START_FINISH is moved to a new position", () => {
		gridStore.placeTile(2, 2, TileType.START_FINISH, 0);
		expect(gridStore.startPosition).toEqual([2, 2]);
		gridStore.placeTile(10, 12, TileType.START_FINISH, 90);
		expect(gridStore.startPosition).toEqual([10, 12]);
	});

	it("returns null after removing the START_FINISH tile", () => {
		gridStore.placeTile(5, 5, TileType.START_FINISH, 0);
		expect(gridStore.startPosition).toEqual([5, 5]);
		gridStore.removeTile(5, 5);
		expect(gridStore.startPosition).toBeNull();
	});

	it("returns null after clearGrid", () => {
		gridStore.placeTile(0, 0, TileType.START_FINISH, 0);
		gridStore.clearGrid();
		expect(gridStore.startPosition).toBeNull();
	});

	it("returns position at grid corners correctly", () => {
		gridStore.placeTile(15, 15, TileType.START_FINISH, 270);
		expect(gridStore.startPosition).toEqual([15, 15]);
	});
});

describe("Grid Store — loadTrack", () => {
	it("successfully loads a valid TrackData and grid matches", () => {
		const data: TrackData = {
			version: 1,
			grid: (() => {
				const g = Array.from({ length: 16 }, () =>
					Array<null>(16).fill(null),
				) as TrackData["grid"];
				g[0][0] = { type: TileType.START_FINISH, rotation: 0 };
				g[1][1] = { type: TileType.STRAIGHT, rotation: 90 };
				return g;
			})(),
		};
		gridStore.loadTrack(data);
		expect(gridStore.grid[0][0]).toEqual({
			type: TileType.START_FINISH,
			rotation: 0,
		});
		expect(gridStore.grid[1][1]).toEqual({
			type: TileType.STRAIGHT,
			rotation: 90,
		});
	});

	it("throws an Error and leaves grid unchanged when no START_FINISH tile", () => {
		gridStore.placeTile(3, 3, TileType.STRAIGHT, 0);
		const snapshot = gridStore.grid;

		const data: TrackData = {
			version: 1,
			grid: Array.from({ length: 16 }, () =>
				Array<null>(16).fill(null),
			) as TrackData["grid"],
		};
		expect(() => gridStore.loadTrack(data)).toThrow(Error);
		expect(gridStore.grid).toEqual(snapshot);
	});

	it("throws an Error and leaves grid unchanged when two START_FINISH tiles", () => {
		gridStore.placeTile(3, 3, TileType.STRAIGHT, 0);
		const snapshot = gridStore.grid;

		const data: TrackData = {
			version: 1,
			grid: (() => {
				const g = Array.from({ length: 16 }, () =>
					Array<null>(16).fill(null),
				) as TrackData["grid"];
				g[0][0] = { type: TileType.START_FINISH, rotation: 0 };
				g[1][1] = { type: TileType.START_FINISH, rotation: 0 };
				return g;
			})(),
		};
		expect(() => gridStore.loadTrack(data)).toThrow(Error);
		expect(gridStore.grid).toEqual(snapshot);
	});

	it("atomically replaces the entire grid state on success", () => {
		gridStore.placeTile(0, 0, TileType.START_FINISH, 0);
		gridStore.placeTile(5, 5, TileType.CURVE, 180);

		const data: TrackData = {
			version: 1,
			grid: (() => {
				const g = Array.from({ length: 16 }, () =>
					Array<null>(16).fill(null),
				) as TrackData["grid"];
				g[7][7] = { type: TileType.START_FINISH, rotation: 90 };
				return g;
			})(),
		};
		gridStore.loadTrack(data);
		// Old tiles are gone
		expect(gridStore.grid[0][0]).toBeNull();
		expect(gridStore.grid[5][5]).toBeNull();
		// New tile is present
		expect(gridStore.grid[7][7]).toEqual({
			type: TileType.START_FINISH,
			rotation: 90,
		});
	});
});

describe("Grid Store — getTrackData", () => {
	it("returns a TrackData object with version 1", () => {
		const td = gridStore.getTrackData();
		expect(td.version).toBe(1);
	});

	it("grid in returned TrackData matches current store state", () => {
		gridStore.placeTile(2, 4, TileType.START_FINISH, 180);
		const td = gridStore.getTrackData();
		expect(td.grid[4][2]).toEqual({
			type: TileType.START_FINISH,
			rotation: 180,
		});
	});

	it("mutating the returned TrackData does not affect the store", () => {
		gridStore.placeTile(1, 1, TileType.STRAIGHT, 0);
		gridStore.placeTile(0, 0, TileType.START_FINISH, 0);
		const td = gridStore.getTrackData();
		td.grid[1][1] = null;
		expect(gridStore.grid[1][1]).toEqual({
			type: TileType.STRAIGHT,
			rotation: 0,
		});
	});
});
