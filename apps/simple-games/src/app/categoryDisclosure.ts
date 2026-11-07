/** Local collection layout; never reads or changes a game's saved state. */
import { preferencesKV, type KVStore } from '../storage/kv';
import { loadRecord, saveRecord } from '../storage/repo';
import { categoryDisclosureSchema, type CollapsedCategory } from '../storage/schemas';
import { availableGames } from './gameChannel';
import { GAME_CATEGORIES, type GameCategoryId } from './registry';

let state = categoryDisclosureSchema.defaultValue();
let kvStore: KVStore = preferencesKV;

export async function initCategoryDisclosure(kv: KVStore = preferencesKV): Promise<void> {
  kvStore = kv;
  state = await loadRecord(categoryDisclosureSchema, kv);
}

export function getCollapsedCategories(): readonly CollapsedCategory[] {
  return state.collapsed;
}

function snapshot(id: GameCategoryId): CollapsedCategory {
  return {
    id,
    gameIds: availableGames()
      .filter((game) => game.category === id)
      .map((game) => game.id),
  };
}

function save(collapsed: CollapsedCategory[]): readonly CollapsedCategory[] {
  state = { schemaVersion: 1, collapsed };
  void saveRecord(categoryDisclosureSchema, state, kvStore);
  return getCollapsedCategories();
}

export function toggleCategory(id: GameCategoryId): readonly CollapsedCategory[] {
  return save(
    state.collapsed.some((category) => category.id === id)
      ? state.collapsed.filter((category) => category.id !== id)
      : [...state.collapsed, snapshot(id)],
  );
}

export function setAllCategoriesCollapsed(collapsed: boolean): readonly CollapsedCategory[] {
  if (!collapsed) return save([]);
  // Keep snapshots of already closed shelves: closing all must not dismiss new games.
  return save([
    ...state.collapsed,
    ...GAME_CATEGORIES.filter(
      (category) => !state.collapsed.some((entry) => entry.id === category.id),
    ).map((category) => snapshot(category.id)),
  ]);
}

export function resetCategoryDisclosureForTesting(): void {
  state = categoryDisclosureSchema.defaultValue();
  kvStore = preferencesKV;
}
