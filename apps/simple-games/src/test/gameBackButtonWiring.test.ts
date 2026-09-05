/**
 * The native hardware Back button has exactly one owner at any moment
 * (issue #120, docs/ARCHITECTURE.md「ハードウェア戻るボタン」— that section
 * names this file as the half of the contract that gates the games). Inside
 * a running game the owner is its own GameContext, and the shell's own
 * single listener (App.tsx, for the settings screen) only stays the only
 * *other* one if every one of the thirty games wires theirs the same way.
 *
 * Why a second listener is a live bug rather than a style nit: Capacitor
 * delivers one `backButton` event to every listener ever registered, not
 * just whichever one a screen would call "current". A GameContext that
 * registers twice — easy to reach for when a rewrite reads screen state from
 * a closure that has gone stale — does not replace its first listener, it
 * adds a second one that fires alongside it. The visible bug is the app
 * minimizing underneath whatever screen the first listener just closed
 * (App.tsx's own comment above its listener says exactly this). A listener
 * registered without the native guard is the same failure by a different
 * door: dead code on web, but a real second owner the day this game also
 * ships as a PWA or the guard is refactored away.
 *
 * Static, like test/refLeading.test.ts and test/shortcutResumeWiring.test.ts,
 * because that is what makes it a gate on the next game rather than on the
 * thirty that exist: a title added tomorrow meets this the moment its
 * GameContext appears, without anyone remembering to add a case.
 *
 * Measured today, across all thirty GameContext.tsx: exactly one
 * `CapacitorApp.addListener('backButton', ...)`, guarded by
 * `if (!Capacitor.isNativePlatform()) return;` as the first statement of the
 * effect that registers it, answering `screen === 'home'` with
 * `exitToCollection()` and anything else by leaving the game's own
 * sub-screen first (24 games do that with `syncActiveGame(); setScreen(
 * 'home');`, six with `goHome()` — this gate does not pick between them: how
 * a game leaves its own sub-screen is its own business, only that it does so
 * before falling through to the collection). The effect's cleanup removes
 * the handle it registered.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GAMES } from '../app/registry';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GAMES_DIR = join(SRC, 'games');

const contextPath = (game: string): string => join(GAMES_DIR, game, 'state', 'GameContext.tsx');
const read = (path: string): string => (existsSync(path) ? readFileSync(path, 'utf8') : '');

/** How the listener is registered — a game may only do this once. */
const REGISTRATION = "addListener('backButton'";
/** The line the registering effect must open with, on every platform. */
const NATIVE_GUARD = 'if (!Capacitor.isNativePlatform()) return;';
/** How the registering effect must open, so the guard has something to lead. */
const EFFECT_HEADER = 'useEffect(() => {';

const ids = GAMES.map((game) => game.id);

describe('the hardware Back button has exactly one owner per game (issue #120)', () => {
  it('is looking at the collection the registry ships', () => {
    // Not `readdirSync` alone: a folder the registry does not carry is not a
    // game, and a game the registry carries without a folder is a broken
    // build. The sibling gates cross-check the same way.
    const games = readdirSync(GAMES_DIR, { withFileTypes: true })
      .filter((dir) => dir.isDirectory())
      .map((dir) => dir.name);
    expect([...games].sort()).toEqual([...ids].sort());
    // A scan that has stopped matching anything must fail loudly rather than
    // silently passing every assertion below on an empty list.
    expect(ids.length).toBeGreaterThan(0);
  });

  it.each(ids)('%s has a GameContext to gate', (game) => {
    expect(existsSync(contextPath(game)), `${game} has no state/GameContext.tsx`).toBe(true);
  });

  it.each(ids)('%s registers the listener exactly once', (game) => {
    const content = read(contextPath(game));
    const occurrences = content.split(REGISTRATION).length - 1;
    expect(
      occurrences,
      `${game} registers 'backButton' ${occurrences} times — a second listener does not ` +
        `replace the first, it fires alongside it, and the visible bug is the app minimizing ` +
        `under whatever screen the first listener just closed (see App.tsx's own comment)`,
    ).toBe(1);
  });

  it.each(ids)('%s only listens on native, from the moment its effect runs', (game) => {
    const lines = read(contextPath(game)).split('\n');
    const registerLine = lines.findIndex((line) => line.includes(REGISTRATION));
    expect(
      registerLine,
      `${game} does not register a 'backButton' listener`,
    ).toBeGreaterThanOrEqual(0);

    // The nearest effect opening above the registration — not just "any
    // useEffect in the file" — because the guard has to be a statement of
    // *that* effect to actually run before this listener is added.
    let effectStart = -1;
    for (let i = registerLine - 1; i >= 0; i--) {
      if (lines[i]!.trim() === EFFECT_HEADER) {
        effectStart = i;
        break;
      }
    }
    expect(
      effectStart,
      `${game}'s backButton listener is not registered inside a 'useEffect(() => {' block`,
    ).toBeGreaterThanOrEqual(0);

    const guarded = lines
      .slice(effectStart + 1, registerLine)
      .some((line) => line.trim() === NATIVE_GUARD);
    expect(
      guarded,
      `${game} registers 'backButton' without "${NATIVE_GUARD}" earlier in the same effect — ` +
        `on web this listener is dead code, but on the platforms that matter it would now fire`,
    ).toBe(true);
  });

  it.each(ids)('%s answers home by leaving to the collection, ahead of anything else', (game) => {
    const content = read(contextPath(game));
    const registerIdx = content.indexOf(REGISTRATION);
    expect(registerIdx, `${game} does not register a 'backButton' listener`).toBeGreaterThanOrEqual(
      0,
    );

    const homeIdx = content.indexOf("screen === 'home'", registerIdx);
    expect(
      homeIdx,
      `${game}'s backButton listener does not branch on "screen === 'home'"`,
    ).toBeGreaterThan(-1);

    const exitIdx = content.indexOf('exitToCollection()', homeIdx);
    expect(
      exitIdx,
      `${game}'s backButton listener does not call exitToCollection() for the home branch`,
    ).toBeGreaterThan(-1);

    // Not checked further than this: which else-branch a game reaches for to
    // leave its own sub-screen (syncActiveGame + setScreen, or goHome) is
    // its own business. Only that the home branch is settled before it.
    const elseIdx = content.indexOf('} else {', exitIdx);
    expect(
      elseIdx,
      `${game} does not fall through to an else branch after exitToCollection() — the home ` +
        `check must be answered before whatever this game does to leave its own sub-screen`,
    ).toBeGreaterThan(exitIdx);
  });

  it.each(ids)('%s removes the handle its effect registered', (game) => {
    const content = read(contextPath(game));
    const registerIdx = content.indexOf(REGISTRATION);
    expect(registerIdx, `${game} does not register a 'backButton' listener`).toBeGreaterThanOrEqual(
      0,
    );

    const cleanupIdx = content.indexOf('backHandle.then((handle) => handle.remove())', registerIdx);
    expect(
      cleanupIdx,
      `${game}'s effect does not remove the handle it registered — a listener that outlives its ` +
        `effect is a second owner the next mount stacks on top of`,
    ).toBeGreaterThan(registerIdx);
  });
});
