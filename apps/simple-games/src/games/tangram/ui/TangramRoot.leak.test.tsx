/**
 * The resource-release contract on the game screen itself
 * (docs/GAME_LIFECYCLE.md, docs/TANGRAM_RULES.md §10). The registry-wide
 * sweep in src/test/lifecycle.test.tsx mounts this game with nothing saved,
 * so it only ever reaches Quick Rules. Here the game is unmounted with
 * everything the game screen owns live: the play clock's interval, the window
 * key listener (useGameKeys), the provider's and the board's
 * visibilitychange listeners, the play area's resize listener, a drag in the
 * hand, a keyboard lift still live at the unmount (its own case: a lift and a
 * drag cannot be live together — a lift holds the pointer off), the result
 * card's beat (ui/useResultReveal.ts) and
 * the card itself. Nothing may survive any of them. There is no animation
 * loop to stop: nothing here draws on its own.
 *
 * Saves go to Capacitor Preferences, mocked as a Map, so nothing here
 * touches the jsdom localStorage the other files share.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { stubMatchMedia, trackResources } from '@/test/lifecycle';
import {
  centroidOf,
  createSession,
  figureById,
  keyboardSnap,
  outlineCenter,
  placePiece,
  PIECE_IDS,
  samePose,
  stepPoint,
  type PieceId,
  type TangramSession,
} from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { TN_STORAGE_KEYS } from '../storage/schemas';
import { TangramRoot } from './TangramRoot';

const { deviceStore } = vi.hoisted(() => ({ deviceStore: new Map<string, string>() }));
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

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });

/** One real macrotask: whatever jsdom queued with a zero timeout has run. */
const macrotask = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

afterEach(async () => {
  cleanup();
  await settle();
  deviceStore.clear();
});

const square = figureById('square')!;
/** The last piece the square's solution needs; everything else is already down. */
const LAST: PieceId = 'S2';

function suspended(): TangramSession {
  let session = createSession(square);
  for (const id of PIECE_IDS) {
    if (id === LAST) continue;
    session = placePiece(session, id, { ...square.solution[id], pv: square.solution[id].at })!;
  }
  return session;
}

/** Quick Rules seen, and the square suspended one piece from complete. */
function seed() {
  deviceStore.set(
    TN_STORAGE_KEYS.flags,
    JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
  );
  deviceStore.set(TN_STORAGE_KEYS.game, JSON.stringify(toPersisted(suspended(), 1)));
}

/** The arrow presses from the lift point to where the last piece snaps home. */
function arrows(): string[] {
  const session = suspended();
  const target = square.solution[LAST];
  const start = outlineCenter(square.outline);
  const goal = centroidOf(LAST, target);
  for (const nx of [-1, 0, 1].map((e) => Math.round(goal[0] - start[0]) + e)) {
    for (const ny of [-1, 0, 1].map((e) => Math.round(goal[1] - start[1]) + e)) {
      let point = start;
      for (let k = 0; k < Math.abs(nx); k++) point = stepPoint(point, Math.sign(nx), 0);
      for (let k = 0; k < Math.abs(ny); k++) point = stepPoint(point, 0, Math.sign(ny));
      const out = keyboardSnap(square.outline, session.board, LAST, target, point);
      if (out.placement && samePose(out.placement, target)) {
        return [
          ...Array<string>(Math.abs(nx)).fill(nx > 0 ? 'ArrowRight' : 'ArrowLeft'),
          ...Array<string>(Math.abs(ny)).fill(ny > 0 ? 'ArrowDown' : 'ArrowUp'),
        ];
      }
    }
  }
  throw new Error('no keyboard path for the last piece');
}

/** Straight onto the suspended figure, the way a home-screen shortcut opens it. */
async function mount() {
  seed();
  const view = render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <TangramRoot onExit={() => undefined} entry="shortcut" />
    </SettingsProvider>,
  );
  await settle();
  expect(screen.getByRole('img', { name: 'Silhouette: Easy 1' })).toBeInTheDocument();
  return view;
}

const piece = (id: PieceId) => document.querySelector<HTMLButtonElement>(`[data-piece="${id}"]`)!;

/** The last piece onto its place by the keyboard: R to its turn, lift, Enter (the snap is there). */
function finish() {
  act(() => piece(LAST).focus());
  for (let k = 0; k < square.solution[LAST].r; k++) {
    fireEvent.keyDown(piece(LAST), { key: 'r' });
  }
  fireEvent.keyDown(piece(LAST), { key: 'Enter' });
  for (const arrow of arrows()) fireEvent.keyDown(piece(LAST), { key: arrow });
  fireEvent.keyDown(piece(LAST), { key: 'Enter' });
}

/**
 * Mounts, completes and unmounts once before tracking: first-use module
 * singletons (the sound service, Capacitor's web shims) belong to the shell's
 * lifetime, not the game's.
 */
async function warmUp() {
  const view = await mount();
  finish();
  await macrotask();
  view.unmount();
  await settle();
  deviceStore.clear();
}

it('releases the clock, the listeners and a drag in the hand', async () => {
  await warmUp();
  const tracker = trackResources();
  try {
    const view = await mount();
    fireEvent.pointerDown(piece('M'), { pointerId: 4, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(piece('M'), { pointerId: 4, clientX: 60, clientY: 60 });
    expect(document.querySelector('.tn-carry')).not.toBeNull();
    view.unmount();
    await settle();
    tracker.assertReleased();
  } finally {
    tracker.restore();
  }
});

it('releases the clock and the listeners with a keyboard lift live at the unmount', async () => {
  await warmUp();
  const tracker = trackResources();
  try {
    const view = await mount();
    act(() => piece('L1').focus());
    fireEvent.keyDown(piece('L1'), { key: 'Enter' });
    fireEvent.keyDown(piece('L1'), { key: 'ArrowLeft' });
    // Still lifted when the game goes: no Escape, no Enter.
    expect(document.querySelector('.tn-carry')).not.toBeNull();
    view.unmount();
    await settle();
    tracker.assertReleased();
  } finally {
    tracker.restore();
  }
});

it('releases the result card’s beat when the figure completes just before it unmounts', async () => {
  // Motion allowed, so the card waits its beat on a live timer.
  const restoreMedia = stubMatchMedia();
  try {
    await warmUp();
    const tracker = trackResources();
    try {
      const view = await mount();
      finish();
      expect(screen.queryByRole('alertdialog')).toBeNull();
      view.unmount();
      await settle();
      tracker.assertReleased();
    } finally {
      tracker.restore();
    }
  } finally {
    restoreMedia();
  }
});

it('releases everything with the result card up', async () => {
  await warmUp();
  const tracker = trackResources();
  try {
    const view = await mount();
    finish();
    expect(screen.getByRole('alertdialog', { name: 'Figure complete' })).toBeInTheDocument();
    // The card's autofocus has jsdom queue a zero-delay selection timer of
    // its own; that one is jsdom's, so it is let run before the question.
    await macrotask();
    view.unmount();
    await settle();
    tracker.assertReleased();
  } finally {
    tracker.restore();
  }
});
