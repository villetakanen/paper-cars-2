import {
	type Rotation,
	TileType,
	type TrackData,
	type TrackGrid,
	type TrackTile,
} from "../types/track";

const GRID_SIZE = 16;
const TRACK_VERSION = 1;

function createEmptyGrid(): TrackGrid {
	return Array.from({ length: GRID_SIZE }, () =>
		Array<TrackTile | null>(GRID_SIZE).fill(null),
	);
}

function isOutOfBounds(x: number, z: number): boolean {
	return x < 0 || x >= GRID_SIZE || z < 0 || z >= GRID_SIZE;
}

class GridStore {
	private _grid: TrackGrid = $state(createEmptyGrid());

	isValid: boolean = $derived.by(() => {
		let count = 0;
		for (const row of this._grid) {
			for (const cell of row) {
				if (cell?.type === TileType.START_FINISH) count++;
			}
		}
		return count === 1;
	});

	startPosition: [number, number] | null = $derived.by(() => {
		for (let z = 0; z < GRID_SIZE; z++) {
			for (let x = 0; x < GRID_SIZE; x++) {
				if (this._grid[z][x]?.type === TileType.START_FINISH) {
					return [x, z];
				}
			}
		}
		return null;
	});

	get grid(): TrackGrid {
		return $state.snapshot(this._grid) as TrackGrid;
	}

	placeTile(x: number, z: number, type: TileType, rotation: Rotation): void {
		if (isOutOfBounds(x, z)) return;

		// START_FINISH singularity: remove any existing START_FINISH tile
		if (type === TileType.START_FINISH) {
			for (let row = 0; row < GRID_SIZE; row++) {
				for (let col = 0; col < GRID_SIZE; col++) {
					if (this._grid[row][col]?.type === TileType.START_FINISH) {
						this._grid[row][col] = null;
					}
				}
			}
		}

		this._grid[z][x] = { type, rotation };
	}

	rotateTile(x: number, z: number): void {
		if (isOutOfBounds(x, z)) return;
		const tile = this._grid[z][x];
		if (tile === null) return;
		const nextRotation = ((tile.rotation + 90) % 360) as Rotation;
		this._grid[z][x] = { type: tile.type, rotation: nextRotation };
	}

	removeTile(x: number, z: number): void {
		if (isOutOfBounds(x, z)) return;
		this._grid[z][x] = null;
	}

	clearGrid(): void {
		this._grid = createEmptyGrid();
	}

	loadTrack(data: TrackData): void {
		let count = 0;
		for (const row of data.grid) {
			for (const cell of row) {
				if (cell?.type === TileType.START_FINISH) count++;
			}
		}
		if (count !== 1) {
			throw new Error(
				`loadTrack: track must contain exactly one START_FINISH tile, found ${count}`,
			);
		}
		this._grid = structuredClone(data.grid);
	}

	getTrackData(): TrackData {
		return {
			version: TRACK_VERSION,
			grid: $state.snapshot(this._grid) as TrackGrid,
		};
	}
}

export const gridStore = new GridStore();
