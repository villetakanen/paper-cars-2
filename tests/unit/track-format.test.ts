import { describe, expect, it } from "vitest";
import { decodeTrack, encodeTrack } from "../../src/lib/track/codec";
import { TileType, type TrackGrid } from "../../src/lib/types/track";

function createEmptyGrid(): TrackGrid {
	return Array.from({ length: 16 }, () => Array(16).fill(null));
}

describe("Track Codec", () => {
	it("should encode and decode an empty grid with one START_FINISH tile", () => {
		const grid = createEmptyGrid();
		grid[0][0] = { type: TileType.START_FINISH, rotation: 0 };

		const encoded = encodeTrack(grid);
		const decoded = decodeTrack(encoded);

		expect(decoded.version).toBe(1);
		expect(decoded.grid[0][0]).toEqual({ type: TileType.START_FINISH, rotation: 0 });
		expect(decoded.grid[0][1]).toBeNull();
	});

	it("should maintain 100% fidelity in a complex roundtrip", () => {
		const grid = createEmptyGrid();
		grid[0][0] = { type: TileType.START_FINISH, rotation: 90 };
		grid[5][5] = { type: TileType.STRAIGHT, rotation: 180 };
		grid[10][10] = { type: TileType.CURVE, rotation: 270 };
		grid[15][15] = { type: TileType.BRIDGE, rotation: 0 };

		const encoded = encodeTrack(grid);
		const decoded = decodeTrack(encoded);

		expect(decoded.grid).toEqual(grid);
	});

	it("should produce a fixed-length payload of 344 characters (excluding version prefix)", () => {
		const grid = createEmptyGrid();
		grid[0][0] = { type: TileType.START_FINISH, rotation: 0 };

		const encoded = encodeTrack(grid);
		const [_version, payload] = encoded.split(":");

		expect(payload.length).toBe(344);
	});

	it("should be deterministic (same grid = same string)", () => {
		const grid1 = createEmptyGrid();
		grid1[8][8] = { type: TileType.START_FINISH, rotation: 0 };

		const grid2 = createEmptyGrid();
		grid2[8][8] = { type: TileType.START_FINISH, rotation: 0 };

		expect(encodeTrack(grid1)).toBe(encodeTrack(grid2));
	});

	describe("Validation", () => {
		it("should throw if START_FINISH is missing", () => {
			const grid = createEmptyGrid();
			// No START_FINISH
			expect(() => encodeTrack(grid)).not.toThrow(); // Encoder doesn't validate (allows partial tracks in editor)
			const encoded = encodeTrack(grid);
			expect(() => decodeTrack(encoded)).toThrow(/must contain exactly one START_FINISH/);
		});

		it("should throw if multiple START_FINISH tiles exist", () => {
			const grid = createEmptyGrid();
			grid[0][0] = { type: TileType.START_FINISH, rotation: 0 };
			grid[0][1] = { type: TileType.START_FINISH, rotation: 0 };

			const encoded = encodeTrack(grid);
			expect(() => decodeTrack(encoded)).toThrow(/found 2/);
		});

		it("should throw if version is unsupported", () => {
			const grid = createEmptyGrid();
			grid[0][0] = { type: TileType.START_FINISH, rotation: 0 };
			const encoded = encodeTrack(grid);
			const invalidVersion = encoded.replace("1:", "99:");

			expect(() => decodeTrack(invalidVersion)).toThrow(/Unsupported track version: 99/);
		});

		it("should throw if payload length is invalid", () => {
			const grid = createEmptyGrid();
			grid[0][0] = { type: TileType.START_FINISH, rotation: 0 };
			const encoded = encodeTrack(grid);
			const shortPayload = encoded.slice(0, -10);

			expect(() => decodeTrack(shortPayload)).toThrow(/Invalid payload length/);
		});
	});

	it("should complete encoding/decoding in < 5ms", () => {
		const grid = createEmptyGrid();
		grid[0][0] = { type: TileType.START_FINISH, rotation: 0 };
		for (let i = 1; i < 256; i++) {
			grid[Math.floor(i / 16)][i % 16] = { type: TileType.STRAIGHT, rotation: 0 };
		}

		const start = performance.now();
		const encoded = encodeTrack(grid);
		decodeTrack(encoded);
		const end = performance.now();

		expect(end - start).toBeLessThan(5);
	});
});
