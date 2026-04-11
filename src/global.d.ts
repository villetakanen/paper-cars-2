import type { gridStore } from "./lib/grid/store.svelte";

declare global {
	interface Window {
		gridStore: typeof gridStore;
	}
}
