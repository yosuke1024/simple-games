/**
 * A game's catalog must load with the game (issue #38): every file the
 * registry's loaders dynamically import IN ORDER TO RENDER SOMETHING has to
 * register the game's messages first, via a side-effect `import '../i18n'`.
 * In production a missing import means raw message keys on screen; render
 * tests cannot catch it because setup.ts registers every catalog for them.
 * This static check is what does.
 *
 * `loadStorageSchemas` is the one loader that is exempt, and it is named here
 * rather than filtered by file extension so the exemption cannot quietly grow
 * (issue #160). It reaches into the game's chunk for its record schemas —
 * what Backup & Restore validates a file's records with — and renders
 * nothing, so there is no string for a missing catalog to break. Pulling i18n
 * into `storage/schemas.ts` would tie the storage layer to the catalog for no
 * reader's benefit. Every game still has to have at least one rendering entry
 * point, checked below, so a game cannot escape the rule by declaring only
 * this one.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The registry's dynamic loaders name every entry point into a game chunk. */
const registrySource = readFileSync(join(SRC, 'app/registry.ts'), 'utf8');
const loaders = [...registrySource.matchAll(/import\('\.\.\/games\/([^/]+)\/([^']+)'\)/g)].map(
  ([, game, rest]) => ({ game: game!, rest: rest! }),
);
/** The schema loader every game declares: reaches into the chunk, renders nothing. */
const SCHEMAS_LOADER = 'storage/schemas';
const chunkEntries = loaders
  .filter(({ rest }) => rest !== SCHEMAS_LOADER)
  .map(({ game, rest }) => ({ game, file: join(SRC, 'games', game, `${rest}.tsx`) }));
const schemaEntries = loaders
  .filter(({ rest }) => rest === SCHEMAS_LOADER)
  .map(({ game, rest }) => ({ game, file: join(SRC, 'games', game, `${rest}.ts`) }));
const hasCatalog = (game: string) => existsSync(join(SRC, 'games', game, 'i18n/index.ts'));

describe('game i18n wiring', () => {
  it('found the registry loaders', () => {
    // One loadRoot per game at minimum; a scanner that reads nothing must
    // fail loudly, not pass emptily.
    expect(chunkEntries.length).toBeGreaterThanOrEqual(10);
    for (const { file } of chunkEntries) expect(existsSync(file), file).toBe(true);
  });

  it('every game declares exactly one schema loader, and it resolves', () => {
    // The exemption above is only safe while it is this narrow: one
    // non-rendering loader per game, pointing at a file that exists.
    const games = [...new Set(chunkEntries.map(({ game }) => game))].sort();
    expect(schemaEntries.map(({ game }) => game).sort()).toEqual(games);
    for (const { file } of schemaEntries) expect(existsSync(file), file).toBe(true);
  });

  it("every chunk entry point of a game with its own catalog imports '../i18n'", () => {
    const offenders = chunkEntries
      .filter(({ game }) => hasCatalog(game))
      .filter(({ file }) => !readFileSync(file, 'utf8').includes("import '../i18n';"))
      .map(({ game, file }) => `${game}: ${file.slice(SRC.length + 1)}`);
    expect(offenders).toEqual([]);
  });

  it('every game catalog registers under its own folder name', () => {
    // A copy-pasted id would overwrite another game's catalog in the runtime
    // registry the moment both games have been opened.
    const games = [...new Set(chunkEntries.map(({ game }) => game))];
    const offenders = games
      .filter(hasCatalog)
      .filter(
        (game) =>
          !readFileSync(join(SRC, 'games', game, 'i18n/index.ts'), 'utf8').includes(
            `registerGameMessages('${game}'`,
          ),
      );
    expect(offenders).toEqual([]);
  });
});
