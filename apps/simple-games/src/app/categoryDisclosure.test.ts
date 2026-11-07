import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryKV, type KVStore } from '../storage/kv';
import { clearLocalData, loadRecord } from '../storage/repo';
import { categoryDisclosureSchema, STORAGE_KEYS } from '../storage/schemas';
import {
  getCollapsedCategories,
  initCategoryDisclosure,
  resetCategoryDisclosureForTesting,
  setAllCategoriesCollapsed,
  toggleCategory,
} from './categoryDisclosure';
import { GAME_CATEGORIES } from './registry';

beforeEach(resetCategoryDisclosureForTesting);

describe('category layout persistence', () => {
  it('starts open and remembers independent choices after a fresh load', async () => {
    const kv = createMemoryKV();
    await initCategoryDisclosure(kv);
    expect(getCollapsedCategories()).toEqual([]);
    toggleCategory('logic');
    toggleCategory('cards');
    toggleCategory('logic');
    await initCategoryDisclosure(kv);
    expect(getCollapsedCategories().map((entry) => entry.id)).toEqual(['cards']);
    expect(getCollapsedCategories()[0]?.gameIds).toContain('solitaire');
  });

  it('serializes rapid changes and resets without resurrecting pending writes', async () => {
    const kv = createMemoryKV();
    await initCategoryDisclosure(kv);
    setAllCategoriesCollapsed(true);
    expect(getCollapsedCategories()).toHaveLength(GAME_CATEGORIES.length);
    setAllCategoriesCollapsed(false);
    toggleCategory('board');
    await initCategoryDisclosure(kv);
    expect(getCollapsedCategories().map((entry) => entry.id)).toEqual(['board']);
    toggleCategory('logic');
    await clearLocalData([STORAGE_KEYS.categoryDisclosure], kv);
    await initCategoryDisclosure(kv);
    expect(getCollapsedCategories()).toEqual([]);
  });

  it('keeps old shelf snapshots when closing all, so new arrivals stay marked', async () => {
    const kv = createMemoryKV({
      [STORAGE_KEYS.categoryDisclosure]: JSON.stringify({
        schemaVersion: 1,
        collapsed: [{ id: 'logic', gameIds: ['sudoku'] }],
      }),
    });
    await initCategoryDisclosure(kv);
    setAllCategoriesCollapsed(true);
    expect(getCollapsedCategories().find((entry) => entry.id === 'logic')?.gameIds).toEqual([
      'sudoku',
    ]);
    toggleCategory('logic');
    toggleCategory('logic');
    expect(getCollapsedCategories().find((entry) => entry.id === 'logic')?.gameIds).toContain(
      'minesweeper',
    );
  });

  it('falls back to open for corrupt data and keeps working when storage rejects', async () => {
    for (const value of [
      'bad json',
      '{"schemaVersion":2}',
      '{"schemaVersion":1,"collapsed":[{"id":"logic","gameIds":[7]}]}',
    ]) {
      await initCategoryDisclosure(createMemoryKV({ [STORAGE_KEYS.categoryDisclosure]: value }));
      expect(getCollapsedCategories()).toEqual([]);
    }
    const fail = async () => {
      throw new Error('unavailable');
    };
    const kv: KVStore = { get: fail, set: fail, remove: fail };
    await initCategoryDisclosure(kv);
    expect(toggleCategory('cards').map((entry) => entry.id)).toEqual(['cards']);
    await expect(loadRecord(categoryDisclosureSchema, kv)).resolves.toEqual({
      schemaVersion: 1,
      collapsed: [],
    });
  });
});
