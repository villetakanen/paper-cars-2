/**
 * Game mode store — coordinates editor/drive state across all modules.
 * Spec: specs/drive-mode/spec.md
 */

export type GameMode = "editor" | "drive";

class GameModeStore {
	current: GameMode = $state("editor");
}

export const gameModeStore = new GameModeStore();
