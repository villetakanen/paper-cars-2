import {
	type Rotation,
	TileType,
	type TrackGrid,
	type TrackTile,
} from "../types/track";

const GRID_SIZE = 16;

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

	get grid(): TrackGrid {
		return structuredClone(this._grid);
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

	removeTile(x: number, z: number): void {
		if (isOutOfBounds(x, z)) return;
		this._grid[z][x] = null;
	}

	clearGrid(): void {
		this._grid = createEmptyGrid();
	}
}

export const gridStore = new GridStore();
