/**
 * The app's side of the share landing (docs/architecture/share-links.md,
 * "Coupling with the landing").
 *
 * pixapps-landing builds a static page for every shared game from this
 * repository, at whatever ref the web is published from. Its sync
 * (scripts/sync-simple-games-share.js there) does two things here that no
 * import graph shows:
 *
 *   1. It parses src/app/registry.ts with the TypeScript compiler, without
 *      running it, and reads `id`, `title`, `glyph` and `channel` as string
 *      literals from the object literals of the `GAMES` array literal.
 *   2. It loads src/services/gameArtworkImage.ts through Vite and calls
 *      `gameArtworkSvg(id)` for each game it publishes (every one not
 *      `in-development`), keeping the SVG only if it is self-contained.
 *
 * A registry refactor that spreads a shared object into an entry, computes a
 * title or moves the artwork module would build and test green here and then
 * fail the web Publish, or worse, publish a game with the wrong availability.
 * These tests make such a change fail in this repository first. Change the
 * landing's sync before changing either shape.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SHARE_BASE_URL } from '@simple-games/brand';
import { GAMES } from '../app/registry';
import { gameArtworkSvg } from '../services/gameArtworkImage';
import {
  appGameIds,
  landingProblem,
  readRegistryGames,
  SHARE_LANDING_BASE,
} from '../../scripts/share-landing-check.mjs';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const registrySource = readFileSync(resolve(APP, 'src/app/registry.ts'), 'utf8');

/** What the landing's build refuses in an artwork (tools/build-simple-games-share.js `validate`). */
const LANDING_REFUSES = /<script|<foreignObject|\bon\w+\s*=|\bhref\s*=|var\(|currentColor/i;

describe('the registry, as the share landing reads it', () => {
  it('is a literal GAMES array whose title cards are the running registry', () => {
    expect(readRegistryGames(registrySource)).toEqual(
      GAMES.map(({ id, title, glyph, channel }) =>
        channel === undefined ? { id, title, glyph } : { id, title, glyph, channel },
      ),
    );
  });

  it('refuses the shapes a literal reader would misread', () => {
    const entry = (fields: string) => `export const GAMES = [{ ${fields} }];`;
    const ok = "id: 'one', title: 'One', glyph: '1'";
    expect(readRegistryGames(entry(ok))).toEqual([{ id: 'one', title: 'One', glyph: '1' }]);
    expect(readRegistryGames(entry(`${ok}, 'channel': 'web-beta'`))[0]?.channel).toBe('web-beta');

    // A spread could carry `channel` past the reader: a Web-only game listed as in the app.
    expect(() => readRegistryGames(entry(`...BETA, ${ok}`))).toThrow(/spreads/);
    expect(() => readRegistryGames(entry("id: 'one', title: TITLE, glyph: '1'"))).toThrow(/title/);
    expect(() => readRegistryGames(entry("id: 'one', title: `One`, glyph: '1'"))).toThrow(/title/);
    expect(() => readRegistryGames(entry("id, title: 'One', glyph: '1'"))).toThrow(/id/);
    expect(() => readRegistryGames(entry(`${ok}, [KEY]: 'web-beta'`))).toThrow(/computed/);
    expect(() => readRegistryGames(entry(`${ok}, channel: 'beta'`))).toThrow(/channel/);
    expect(() => readRegistryGames(entry("title: 'One', glyph: '1'"))).toThrow(/id/);
    expect(() => readRegistryGames('export const GAMES = [...RELEASED];')).toThrow(
      /object literal/,
    );
    expect(() => readRegistryGames('export const GAMES = makeGames();')).toThrow(/array literal/);
    expect(() =>
      readRegistryGames("export const GAMES = [{ id: 'a', title: 'A', glyph: 'a' }] as const;"),
    ).toThrow(/array literal/);
  });

  it('draws every game the landing publishes as a self-contained SVG', () => {
    // The landing loads this exact module by path, and this exact export.
    const module = resolve(APP, 'src/services/gameArtworkImage.ts');
    expect(existsSync(module)).toBe(true);
    expect(readFileSync(module, 'utf8')).toMatch(/^export function gameArtworkSvg\(/m);

    for (const game of GAMES) {
      if (game.channel === 'in-development') continue;
      const svg = gameArtworkSvg(game.id);
      expect(svg, game.id).not.toBeNull();
      if (svg === null) continue;
      expect(svg.startsWith('<svg '), game.id).toBe(true);
      expect(svg.endsWith('</svg>'), game.id).toBe(true);
      expect(svg, game.id).not.toMatch(LANDING_REFUSES);
      // The landing drops the serializer's duplicate namespace, then needs valid XML.
      let seen = false;
      const xml = svg.replace(/ xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, (attribute) => {
        if (seen) return '';
        seen = true;
        return attribute;
      });
      const parsed = new DOMParser().parseFromString(xml, 'image/svg+xml');
      expect(parsed.querySelector('parsererror'), game.id).toBeNull();
    }
  });
});

describe('the release gate (scripts/share-landing-check.mjs)', () => {
  it('requests the address the app shares, for every game the app offers', () => {
    expect(SHARE_LANDING_BASE).toBe(SHARE_BASE_URL);
    expect(appGameIds(readRegistryGames(registrySource))).toEqual(
      GAMES.filter((game) => game.channel === undefined).map((game) => game.id),
    );
  });

  it("passes only the game's own landing, answered directly", () => {
    const page = (id: string, extra = '') =>
      `<!DOCTYPE html><html><body data-game="${id}"><main>${extra}</main></body></html>`;
    const html = 'text/html; charset=utf-8';
    expect(
      landingProblem('sudoku', { status: 200, contentType: html, body: page('sudoku') }),
    ).toBeNull();

    expect(landingProblem('sudoku', { status: 404, contentType: html, body: '' })).toBe('HTTP 404');
    expect(
      landingProblem('sudoku', {
        status: 308,
        location: '/simple-games/share/',
        contentType: '',
        body: '',
      }),
    ).toBe('HTTP 308 → /simple-games/share/');
    expect(
      landingProblem('sudoku', {
        status: 200,
        contentType: 'application/json',
        body: page('sudoku'),
      }),
    ).toMatch(/not HTML/);
    // The collection fallback, or another game's page.
    expect(landingProblem('sudoku', { status: 200, contentType: html, body: page('') })).toMatch(
      /not this game/,
    );
    expect(
      landingProblem('sudoku', { status: 200, contentType: html, body: page('sudoku-6x6') }),
    ).toMatch(/not this game/);
    // A Web-only or retired page: it exists, but tells the reader the game is not in the app.
    expect(
      landingProblem('sudoku', {
        status: 200,
        contentType: html,
        body: page('sudoku', '<p class="availability">…</p>'),
      }),
    ).toMatch(/not in the app/);
  });
});
