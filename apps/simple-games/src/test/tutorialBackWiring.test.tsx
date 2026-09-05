/**
 * What hardware Back does from the Quick Rules tutorial (issue #142), pinned
 * behaviourally rather than by shape.
 *
 * The bug: every game's `backButton` handler (state/GameContext.tsx) answers
 * anything other than `screen === 'home'` by leaving the sub-screen the
 * player is on and landing on the game's own home — without ever calling
 * `completeTutorial()`. That is the right move from a level picker or a
 * stats screen, but the tutorial is not an ordinary sub-screen: it is the
 * screen `initialFlags.tutorialCompleted` decides whether to show at all,
 * and it renders no close button until that flag is already true. A player
 * who presses Back on their very first launch — the most natural thing to do
 * with an unfamiliar hardware button — leaves without the flag ever being
 * set, so the next launch of that game opens on the tutorial again — and
 * every launch after that, until the player taps through all three steps,
 * because playing never sets the flag; only the tutorial's own last button
 * does. docs/PRODUCT_PRINCIPLES.md「初回体験の原則」asks for an explanation of
 * at most three steps that leads straight into play; it never asks for that
 * explanation to be repeated.
 *
 * The fix (scripts/codemods/2026-09-06-tutorial-back-completes.mjs, one
 * insertion in every `state/GameContext.tsx`) makes Back from the tutorial
 * call `completeTutorial()` on the way to the game's home, the same call the
 * tutorial's own "Start Playing" button already makes. This file proves that
 * from outside the fix, for all thirty games at once: seed no records
 * (a first-ever open), press the hardware button, and check what a second
 * launch actually sees — not that some function was called, but that the
 * record a real reinstall reads back has the flag set, and that the tutorial
 * screen the player already dismissed does not come back.
 *
 * Behavioural rather than static, unlike its sibling
 * `test/gameBackButtonWiring.test.ts` (issue #120), on purpose: that file
 * pins HOW the one `backButton` listener per game is wired — one
 * registration, native-guarded, `screen === 'home'` answered before anything
 * else, the handle released on cleanup — a shape check that catches a second
 * listener or a missing guard without ever running a game. What it cannot
 * see is WHAT the "leave this sub-screen" branch does before it sets
 * `screen` to `'home'`, and that is exactly where this bug and its fix both
 * live: a codemod could satisfy every shape rule in that file and still
 * leave `completeTutorial()` uncalled, or call it from the wrong branch, or
 * call it without persisting the record. Only mounting a Root, firing the
 * plugin event, and reading the device store back — the way a player's
 * install actually round-trips this flag across a process kill — pins that
 * the fix does what the issue asks, not merely that it looks like it does.
 *
 * One file for all thirty for the same reason as that sibling: the loop
 * below reads `GAMES` from the registry, so a thirty-first game meets this
 * contract the moment its entry is added, with no per-game test to remember.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAMES } from '@/app/registry';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';

const { deviceStore, appMock } = vi.hoisted(() => {
  type Listener = (event: unknown) => void;
  const listeners = new Map<string, Set<Listener>>();
  return {
    deviceStore: new Map<string, string>(),
    appMock: {
      listeners,
      /** Delivers one plugin event to every listener currently registered. */
      fire(name: string) {
        for (const listener of [...(listeners.get(name) ?? [])]) listener({});
      },
      App: {
        addListener: vi.fn((name: string, listener: Listener) => {
          if (!listeners.has(name)) listeners.set(name, new Set());
          listeners.get(name)!.add(listener);
          return Promise.resolve({
            remove: () => {
              listeners.get(name)?.delete(listener);
            },
          });
        }),
      },
    },
  };
});

// Native platform, like SudokuRoot.back.test.tsx: `backButton` only exists on
// Android/iOS, and forcing it here is what lets a jsdom test fire the same
// event the hardware button sends, for every game in one pass.
vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...actual,
    Capacitor: { ...actual.Capacitor, isNativePlatform: () => true, getPlatform: () => 'android' },
  };
});

vi.mock('@capacitor/app', () => ({ App: appMock.App }));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: ({ key }: { key: string }) => Promise.resolve({ value: deviceStore.get(key) ?? null }),
    set: ({ key, value }: { key: string; value: string }) => {
      deviceStore.set(key, value);
      return Promise.resolve();
    },
    remove: ({ key }: { key: string }) => {
      deviceStore.delete(key);
      return Promise.resolve();
    },
  },
}));

type RootComponent = Awaited<ReturnType<(typeof GAMES)[number]['loadRoot']>>['default'];

/** The one press Android sends; every registered listener hears it. */
const pressBack = () => act(() => appMock.fire('backButton'));

/** Lets the async record load (and whatever it triggers) land. */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25));
  });

function launch(Root: RootComponent, onExit: () => void) {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <Root onExit={onExit} />
    </SettingsProvider>,
  );
}

const tutorialHeading = () => screen.queryByRole('heading', { level: 1, name: 'How to Play' });

afterEach(() => {
  cleanup();
  deviceStore.clear();
  appMock.listeners.clear();
  vi.clearAllMocks();
});

describe('hardware Back from the Quick Rules tutorial completes it (issue #142)', () => {
  for (const game of GAMES) {
    it(`${game.id}: Back from its first-ever tutorial is remembered on the next launch`, async () => {
      const flagsKeys = game.storageKeys.filter((key) => key.endsWith('.flags'));
      expect(
        flagsKeys,
        `${game.id} has ${flagsKeys.length} storageKeys ending in ".flags" (${JSON.stringify(
          game.storageKeys,
        )}) — expected exactly one, the record completeTutorial() writes to`,
      ).toHaveLength(1);
      const flagsKey = flagsKeys[0]!;

      // Through the registry's own loader, like lifecycle.test.tsx, so a
      // broken lazy chunk fails here rather than on a player's device.
      const Root = (await game.loadRoot()).default;

      // 1. First-ever open: nothing in the device store yet.
      const firstExit = vi.fn();
      launch(Root, firstExit);
      await settle();

      expect(
        tutorialHeading(),
        `${game.id} did not show its Quick Rules tutorial on a first-ever open ` +
          `(no heading role="heading" level 1 named "How to Play")`,
      ).toBeInTheDocument();
      expect(firstExit).not.toHaveBeenCalled();

      // 2. Press Back once. This must land on the game's own home, not
      // walk out to the collection — and it must remember that the
      // tutorial was seen, the same as tapping its own "Start Playing" would.
      pressBack();
      await settle();

      expect(
        firstExit,
        `${game.id} called onExit() on the first Back press from its tutorial — that press ` +
          `must land on the game's own home, not out to the collection`,
      ).not.toHaveBeenCalled();
      expect(
        tutorialHeading(),
        `${game.id} still shows its tutorial heading after a Back press left it`,
      ).not.toBeInTheDocument();

      // The save is the point: this is what survives the process kill an
      // Android Back-then-relaunch actually is, not just an in-memory flag.
      const stored = deviceStore.get(flagsKey);
      expect(
        stored,
        `${game.id} did not persist ${flagsKey} after Back from the tutorial — ` +
          `completeTutorial() was not called (or not awaited) on that path`,
      ).toBeDefined();
      const parsed: unknown = JSON.parse(stored!);
      const tutorialCompleted =
        typeof parsed === 'object' && parsed !== null
          ? (parsed as Record<string, unknown>).tutorialCompleted
          : undefined;
      expect(
        tutorialCompleted,
        `${game.id}'s ${flagsKey} after Back from the tutorial was ${stored} — ` +
          `tutorialCompleted must be true`,
      ).toBe(true);

      // Cheap and it is the invariant the shell depends on (issue #120):
      // completing the tutorial must not have left a second listener behind.
      expect(appMock.listeners.get('backButton')?.size).toBe(1);

      // 3. The player leaves and, later, reopens the same game.
      cleanup();
      const secondExit = vi.fn();
      launch(Root, secondExit);
      await settle();

      expect(
        tutorialHeading(),
        `${game.id} showed its tutorial again on the next launch — Back on the first launch ` +
          `did not actually save that it was completed`,
      ).not.toBeInTheDocument();

      // 4. One Back from here must leave the game (home → collection),
      // proving this launch opened on the game's home and not somewhere
      // else the tutorial's absence could also be explained by.
      pressBack();
      await settle();

      expect(
        secondExit,
        `${game.id}: one Back press from the post-tutorial launch did not call onExit() ` +
          `exactly once — this launch was not sitting on the game's home screen`,
      ).toHaveBeenCalledTimes(1);
    }, 20_000);
  }
});
