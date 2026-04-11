import { describe, expect, it } from "vitest";
import { TILE_ASSETS } from "../../src/lib/components/assets";
import { GRID_SIZE, TILE_SIZE } from "../../src/lib/components/constants";
import { TileType } from "../../src/lib/types/track";

describe("Asset manifest — TILE_ASSETS", () => {
	it("has an entry for every TileType", () => {
		for (const tileType of Object.values(TileType)) {
			expect(TILE_ASSETS[tileType]).toBeDefined();
			expect(typeof TILE_ASSETS[tileType]).toBe("string");
		}
	});

	it("all asset paths point to .glb files", () => {
		for (const path of Object.values(TILE_ASSETS)) {
			expect(path).toMatch(/\.glb$/);
		}
	});

	it("all asset paths are under /assets/tiles/", () => {
		for (const path of Object.values(TILE_ASSETS)) {
			expect(path).toMatch(/^\/assets\/tiles\//);
		}
	});

	it("has exactly as many entries as TileType values", () => {
		const tileTypeCount = Object.values(TileType).length;
		const assetCount = Object.keys(TILE_ASSETS).length;
		expect(assetCount).toBe(tileTypeCount);
	});
});

describe("Renderer constants", () => {
	it("TILE_SIZE is a positive number", () => {
		expect(TILE_SIZE).toBeGreaterThan(0);
	});

	it("GRID_SIZE is 16", () => {
		expect(GRID_SIZE).toBe(16);
	});
});
