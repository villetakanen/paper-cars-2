import {
	type Rotation,
	TileType,
	type TrackData,
	type TrackGrid,
} from "../types/track";

const GRID_SIZE = 16;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
const CURRENT_VERSION = 1;

const TILE_TYPE_ORDER: TileType[] = [
	TileType.STRAIGHT,
	TileType.CURVE,
	TileType.RAMP,
	TileType.LOOP,
	TileType.BRIDGE,
	TileType.START_FINISH,
];

/**
 * Encodes a 16x16 grid into a version-prefixed Base64URL string.
 * Format: "version:base64url_payload"
 */
export function encodeTrack(grid: TrackGrid): string {
	const bytes = new Uint8Array(TOTAL_CELLS);

	for (let z = 0; z < GRID_SIZE; z++) {
		for (let x = 0; x < GRID_SIZE; x++) {
			const cell = grid[z][x];
			const index = z * GRID_SIZE + x;

			if (cell === null) {
				bytes[index] = 0;
			} else {
				const typeIndex = TILE_TYPE_ORDER.indexOf(cell.type);
				const rotationIndex = Math.floor(cell.rotation / 90);
				// Byte = typeIndex * 4 + rotationIndex + 1
				bytes[index] = typeIndex * 4 + rotationIndex + 1;
			}
		}
	}

	return `${CURRENT_VERSION}:${toBase64URL(bytes)}`;
}

/**
 * Decodes a version-prefixed Base64URL string into TrackData.
 * Throws error if validation fails.
 */
export function decodeTrack(serialized: string): TrackData {
	const [versionPart, payload] = serialized.split(":");

	if (!versionPart || !payload) {
		throw new Error("Invalid track format: missing version or payload");
	}

	const version = Number.parseInt(versionPart, 10);
	if (version > CURRENT_VERSION) {
		throw new Error(`Unsupported track version: ${version}`);
	}

	const bytes = fromBase64URL(payload);
	if (bytes.length !== TOTAL_CELLS) {
		throw new Error(
			`Invalid payload length: expected ${TOTAL_CELLS} bytes, got ${bytes.length}`,
		);
	}

	const grid: TrackGrid = Array.from({ length: GRID_SIZE }, () =>
		Array(GRID_SIZE).fill(null),
	);
	let startFinishCount = 0;

	for (let i = 0; i < TOTAL_CELLS; i++) {
		const byte = bytes[i];
		const z = Math.floor(i / GRID_SIZE);
		const x = i % GRID_SIZE;

		if (byte === 0) {
			grid[z][x] = null;
		} else {
			const typeIndex = Math.floor((byte - 1) / 4);
			const rotationIndex = (byte - 1) % 4;

			if (typeIndex >= TILE_TYPE_ORDER.length) {
				throw new Error(`Unknown tile type index: ${typeIndex}`);
			}

			const type = TILE_TYPE_ORDER[typeIndex];
			const rotation = (rotationIndex * 90) as Rotation;

			if (type === TileType.START_FINISH) {
				startFinishCount++;
			}

			grid[z][x] = { type, rotation };
		}
	}

	if (startFinishCount !== 1) {
		throw new Error(
			`Invalid track: must contain exactly one START_FINISH tile, found ${startFinishCount}`,
		);
	}

	return {
		version,
		grid,
	};
}

/**
 * Converts Uint8Array to Base64URL (no padding, URL-safe).
 */
function toBase64URL(bytes: Uint8Array): string {
	const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join(
		"",
	);
	return btoa(binString).replace(/\+/g, "-").replace(/\//g, "_");
}

/**
 * Converts Base64URL string to Uint8Array.
 */
function fromBase64URL(str: string): Uint8Array {
	const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
	const binString = atob(base64);
	return Uint8Array.from(binString, (m) => m.charCodeAt(0));
}
