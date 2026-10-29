/**
 * Tangram through its screens, the way a player meets it
 * (docs/TANGRAM_RULES.md): Quick Rules and straight into a figure; the tap
 * that turns a piece and the drag that places it, with the pointer contract
 * around them (the 6 px slop, `pointercancel`, a second finger, the click a
 * drag leaves); the three buttons; the keyboard alone; the result card and
 * the ↻; the home's tiers, the replace question and the daily; the
 * statistics; the two saved slots and the ways they come back — or, when
 * damaged, do not; a piece in the hand that the page abandons.
 *
 * Saves go to Capacitor Preferences, mocked here as `deviceStore`; every
 * launch reads the same store, as on a phone. jsdom measures nothing, so the
 * play area takes `DEFAULT_PLAY_SIZE` and its box sits at (0, 0): a pointer's
 * client coordinates are play-area pixels, and `playLayout` says where
 * everything is.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import {
  centroidOf,
  createSession,
  dailyFigure,
  figureById,
  figuresOf,
  isFixed,
  keyboardSnap,
  KEYBOARD_TOLERANCE,
  localDateString,
  outlineCenter,
  PIECE_IDS,
  placePiece,
  poseVertices,
  ptToFloat,
  samePose,
  snapPose,
  stepPoint,
  type Figure,
  type PieceId,
  type Placement,
  type Pose,
  type TangramSession,
} from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { TN_STORAGE_KEYS, type PersistedGame, type Progress, type Stats } from '../storage/schemas';
import {
  DEFAULT_PLAY_SIZE,
  playLayout,
  pointerTolerance,
  TRAY_LIFT_PX,
  type PlayLayout,
} from './layout';
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

afterEach(async () => {
  cleanup();
  // An unmount books the play clock into the slot; let that save land
  // before the store is wiped, or it would land in the next test's store.
  await settle();
  deviceStore.clear();
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });

function launch(entry?: 'collection' | 'shortcut') {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <TangramRoot onExit={onExit} entry={entry} />
    </SettingsProvider>,
  );
  return { onExit };
}

/** The app goes to background. */
function background() {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  Reflect.deleteProperty(document, 'visibilityState');
}

const put = (key: string, value: unknown) => deviceStore.set(key, JSON.stringify(value));
const read = <T,>(key: string): T | null => {
  const raw = deviceStore.get(key);
  return raw === undefined ? null : (JSON.parse(raw) as T);
};
const savedGame = () => read<PersistedGame>(TN_STORAGE_KEYS.game);
const savedDaily = () => read<PersistedGame>(TN_STORAGE_KEYS.dailyGame);
const savedStats = () => read<Stats>(TN_STORAGE_KEYS.stats);
const savedProgress = () => read<Progress>(TN_STORAGE_KEYS.progress);

const taughtAlready = () =>
  put(TN_STORAGE_KEYS.flags, { schemaVersion: 1, tutorialCompleted: true });
const suspend = (session: TangramSession) =>
  put(
    session.mode === 'daily' ? TN_STORAGE_KEYS.dailyGame : TN_STORAGE_KEYS.game,
    toPersisted(session, 1),
  );

const square = figureById('square')!;
const triangle = figureById('triangle')!;
const TODAY = localDateString(new Date());

const piece = (id: PieceId) => document.querySelector<HTMLButtonElement>(`[data-piece="${id}"]`)!;
const label = (id: PieceId) => piece(id).getAttribute('aria-label') ?? '';
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const actionBar = () => within(document.querySelector<HTMLElement>('.tn-actions')!);
const rotateButton = () => actionBar().getByRole('button', { name: 'Rotate' });
const flipButton = () => actionBar().getByRole('button', { name: 'Flip' });
const undoButton = () => actionBar().getByRole('button', { name: 'Undo' });
const resultCard = () => screen.queryByRole('alertdialog', { name: 'Figure complete' });
const live = () => document.querySelector('[aria-live="polite"]')!.textContent ?? '';
const key = (k: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(document.activeElement ?? document.body, { key: k, ...init });

const layoutOf = (figure: Figure): PlayLayout =>
  playLayout(DEFAULT_PLAY_SIZE.width, DEFAULT_PLAY_SIZE.height, figure.outline);
const sol = (figure: Figure, id: PieceId): Placement => ({
  ...figure.solution[id],
  pv: figure.solution[id].at,
});

/** The finger that carries a tray piece so its vertex average sits on `pose`'s (§4: 24 px lift). */
function fingerFor(figure: Figure, id: PieceId, pose: Pose): [number, number] {
  const layout = layoutOf(figure);
  const [cx, cy] = centroidOf(id, pose);
  return [layout.originX + cx * layout.ppu, layout.originY + cy * layout.ppu + TRAY_LIFT_PX];
}

/** A press on a tray piece, a carry to (x, y), a release there, and the click the release leaves. */
function dragFromTray(figure: Figure, id: PieceId, [x, y]: [number, number], pointerId = 1) {
  const el = piece(id);
  const [sx, sy] = layoutOf(figure).cells[id];
  fireEvent.pointerDown(el, { pointerId, clientX: sx, clientY: sy });
  fireEvent.pointerMove(el, { pointerId, clientX: x, clientY: y });
  fireEvent.pointerUp(el, { pointerId, clientX: x, clientY: y });
  fireEvent.click(el, { detail: 1 });
}

/** Turns a tray piece to `pose`'s turn and side: taps, and F for the parallelogram. */
function orientInTray(id: PieceId, pose: Pose) {
  for (let k = 0; k < pose.r; k++) fireEvent.click(piece(id));
  if (pose.f === 1) {
    act(() => piece(id).focus());
    key('f');
  }
}

/**
 * The order the snap alone can put a figure's solution down in from the tray
 * (§2「吸着だけで組めること」), worked out on the session the screen will have.
 */
function dragPlan(figure: Figure): PieceId[] {
  const tolerance = pointerTolerance(layoutOf(figure).ppu, KEYBOARD_TOLERANCE);
  let session = createSession(figure);
  const left = PIECE_IDS.filter((id) => !isFixed(session, id));
  const order: PieceId[] = [];
  while (left.length > 0) {
    const index = left.findIndex((id) => {
      const target = figure.solution[id];
      const out = snapPose(figure.outline, session.board, {
        id,
        orientation: target,
        at: ptToFloat(target.at),
        tolerance,
      });
      return out.placement !== null && samePose(out.placement, target);
    });
    if (index < 0) throw new Error(`no snap order for ${figure.id}`);
    const id = left.splice(index, 1)[0]!;
    order.push(id);
    session = placePiece(session, id, { ...figure.solution[id], pv: figure.solution[id].at })!;
  }
  return order;
}

/** Puts the whole solution down by dragging, piece by piece. */
function solveByDragging(figure: Figure, upTo = Infinity) {
  dragPlan(figure)
    .slice(0, upTo)
    .forEach((id, n) => {
      const target = figure.solution[id];
      orientInTray(id, target);
      dragFromTray(figure, id, fingerFor(figure, id, target), 10 + n);
    });
}

async function startEasy() {
  taughtAlready();
  launch();
  await settle();
  fireEvent.click(button(/^Easy/));
  await settle();
}

describe('first run (§9)', () => {
  it('teaches in three pictures, then starts the first Easy figure', async () => {
    const user = userEvent.setup();
    launch();
    await settle();

    expect(screen.getByRole('heading', { level: 1, name: 'How to Play' })).toBeInTheDocument();
    expect(screen.getByText('Drag and turn')).toBeInTheDocument();
    expect(document.querySelector('.tn-figure')).not.toBeNull();
    await user.click(button('Next'));
    expect(screen.getByText('Inside, never on top')).toBeInTheDocument();
    await user.click(button('Next'));
    expect(screen.getByText('Fill it')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Learn More' })).not.toBeInTheDocument();
    await user.click(button('Start Playing'));
    await settle();

    expect(screen.getByRole('img', { name: 'Silhouette: Easy 1' })).toBeInTheDocument();
    expect(screen.getByText('Easy 1')).toBeInTheDocument();
    // Seven pieces, all in the tray, unturned; no clock and no Hint (§3, §7).
    for (const id of PIECE_IDS) expect(label(id)).toMatch(/turned 0°, in the tray$/);
    expect(label('L1')).toBe('Large triangle 1, turned 0°, in the tray');
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
    expect(undoButton()).toBeDisabled();
    // Easy shows a solution's inner lines (§3).
    expect(document.querySelectorAll('.tn-guide')).toHaveLength(7);

    await settle();
    expect(read(TN_STORAGE_KEYS.flags)).toEqual({ schemaVersion: 1, tutorialCompleted: true });
    expect(savedGame()).toMatchObject({ mode: 'free', figure: 'square', pieces: {} });
    expect(savedStats()!.easy.played).toBe(1);
    expect(savedProgress()!.last).toEqual({ easy: 'square' });
  });

  it('resumes a suspended Free Play figure rather than starting over it (§8)', async () => {
    suspend(placePiece(createSession(triangle), 'S1', sol(triangle, 'S1'))!);
    const user = userEvent.setup();
    launch();
    await settle();
    await user.click(button('Next'));
    await user.click(button('Next'));
    await user.click(button('Start Playing'));
    await settle();
    expect(screen.getByText('Easy 2')).toBeInTheDocument();
    expect(label('S1')).toMatch(/on the board$/);
    expect(savedStats()?.easy.played ?? 0).toBe(0);
  });
});

describe('the tap and the drag (§4)', () => {
  it('turns a piece 45° clockwise with a tap — once per press, never twice', async () => {
    await startEasy();
    fireEvent.pointerDown(piece('M'), { pointerId: 3, clientX: 100, clientY: 300 });
    fireEvent.pointerUp(piece('M'), { pointerId: 3, clientX: 100, clientY: 300 });
    fireEvent.click(piece('M'), { detail: 1 });
    expect(label('M')).toBe('Medium triangle, turned 45°, in the tray');
    expect(piece('M')).toHaveAttribute('aria-pressed', 'true');
    // Eight turns bring it back.
    for (let k = 0; k < 7; k++) fireEvent.click(piece('M'), { detail: 1 });
    expect(label('M')).toBe('Medium triangle, turned 0°, in the tray');
    // A tray turn is one operation each (§3).
    expect(undoButton()).toBeEnabled();
    fireEvent.click(undoButton());
    expect(label('M')).toBe('Medium triangle, turned 315°, in the tray');
  });

  it('counts 6 px of travel as a tap, and more as a drag whose click is eaten', async () => {
    await startEasy();
    const [x, y] = layoutOf(square).cells.S2;
    fireEvent.pointerDown(piece('S2'), { pointerId: 1, clientX: x, clientY: y });
    fireEvent.pointerMove(piece('S2'), { pointerId: 1, clientX: x + 6, clientY: y });
    fireEvent.pointerUp(piece('S2'), { pointerId: 1, clientX: x + 6, clientY: y });
    fireEvent.click(piece('S2'), { detail: 1 });
    expect(label('S2')).toMatch(/turned 45°/);

    fireEvent.pointerDown(piece('S2'), { pointerId: 2, clientX: x, clientY: y });
    fireEvent.pointerMove(piece('S2'), { pointerId: 2, clientX: x + 7, clientY: y });
    expect(document.querySelector('.tn-carry')).not.toBeNull();
    fireEvent.pointerUp(piece('S2'), { pointerId: 2, clientX: x + 7, clientY: y });
    fireEvent.click(piece('S2'), { detail: 1 });
    // A drop with nowhere to snap: the tray piece stays, unturned by the click.
    expect(label('S2')).toBe('Small triangle 2, turned 45°, in the tray');
    // A keyboard activation is never eaten (detail 0).
    fireEvent.click(piece('S2'));
    expect(label('S2')).toMatch(/turned 90°/);
  });

  it('places a dragged piece where it was drawn snapped, as one operation that Undo takes back', async () => {
    await startEasy();
    const [id] = dragPlan(square);
    const target = square.solution[id!];
    orientInTray(id!, target);
    const finger = fingerFor(square, id!, target);
    const el = piece(id!);
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 20, clientY: 360 });
    fireEvent.pointerMove(el, { pointerId: 1, clientX: finger[0], clientY: finger[1] });
    // Drawn where it would land: filled (§4).
    expect(document.querySelector('.tn-carry-fits')).not.toBeNull();
    expect(el).toHaveClass('tn-piece-lifted');
    fireEvent.pointerUp(el, { pointerId: 1, clientX: finger[0], clientY: finger[1] });
    fireEvent.click(el, { detail: 1 });
    expect(label(id!)).toMatch(/on the board$/);
    expect(document.querySelector('.tn-carry')).toBeNull();
    await settle();
    expect(savedGame()!.pieces[id!]).toMatchObject({
      r: target.r,
      f: target.f,
      at: [...target.at],
    });

    fireEvent.click(undoButton());
    expect(label(id!)).toMatch(/in the tray$/);
    await settle();
    expect(savedGame()!.pieces).toEqual({});
  });

  it('decides a drop from the pose last drawn, not from where the finger lifts', async () => {
    await startEasy();
    const [id] = dragPlan(square);
    const target = square.solution[id!];
    orientInTray(id!, target);
    const finger = fingerFor(square, id!, target);
    const el = piece(id!);
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 20, clientY: 360 });
    fireEvent.pointerMove(el, { pointerId: 1, clientX: finger[0], clientY: finger[1] });
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 5, clientY: 5 });
    expect(label(id!)).toMatch(/on the board$/);
  });

  it('never drops on a pose that was not drawn: a move and a release in one frame (§4)', async () => {
    await startEasy();
    const [id] = dragPlan(square);
    const target = square.solution[id!];
    orientInTray(id!, target);
    const finger = fingerFor(square, id!, target);
    const el = piece(id!);
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 20, clientY: 360 });
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 2, clientY: 2 });
    expect(document.querySelector('.tn-carry-open')).not.toBeNull();
    // One act: React renders nothing between the move to the fit and the
    // release, so the fit is never on screen — the outline drawn last decides.
    act(() => {
      fireEvent.pointerMove(el, { pointerId: 1, clientX: finger[0], clientY: finger[1] });
      fireEvent.pointerUp(el, { pointerId: 1, clientX: finger[0], clientY: finger[1] });
    });
    fireEvent.click(el, { detail: 1 });
    expect(label(id!)).toMatch(/in the tray$/);
    expect(document.querySelector('.tn-carry')).toBeNull();
    expect(undoButton()).toBeEnabled(); // the orientation's turns, nothing more
    await settle();
    expect(savedGame()!.pieces).toEqual({});
  });

  it('sends a board piece dropped with no room back to the tray, keeping its turn (§3, §4)', async () => {
    await startEasy();
    const [id] = dragPlan(square);
    const target = square.solution[id!];
    orientInTray(id!, target);
    dragFromTray(square, id!, fingerFor(square, id!, target));
    expect(label(id!)).toMatch(/on the board$/);

    // Carry it far off the silhouette and let go.
    const el = piece(id!);
    fireEvent.pointerDown(el, { pointerId: 4, clientX: 150, clientY: 120 });
    fireEvent.pointerMove(el, { pointerId: 4, clientX: 2, clientY: 2 });
    expect(document.querySelector('.tn-carry-open')).not.toBeNull();
    fireEvent.pointerUp(el, { pointerId: 4, clientX: 2, clientY: 2 });
    fireEvent.click(el, { detail: 1 });
    expect(label(id!)).toBe(`${label(id!).split(',')[0]}, turned ${target.r * 45}°, in the tray`);
    // One operation: Undo puts it back where it stood.
    fireEvent.click(undoButton());
    expect(label(id!)).toMatch(/on the board$/);
  });

  it('answers pointercancel: a carried board piece goes to the tray, a tray piece stays (§4)', async () => {
    await startEasy();
    const [first] = dragPlan(square);
    const target = square.solution[first!];
    orientInTray(first!, target);
    dragFromTray(square, first!, fingerFor(square, first!, target));

    // From the tray: nothing changes, and the click the cancel leaves turns nothing.
    const tray = piece('S2');
    fireEvent.pointerDown(tray, { pointerId: 5, clientX: 50, clientY: 330 });
    fireEvent.pointerMove(tray, { pointerId: 5, clientX: 150, clientY: 150 });
    fireEvent.pointerCancel(tray, { pointerId: 5 });
    fireEvent.click(tray, { detail: 1 });
    expect(label('S2')).toBe('Small triangle 2, turned 0°, in the tray');
    expect(document.querySelector('.tn-carry')).toBeNull();

    // From the board: back to the tray, one operation.
    const board = piece(first!);
    fireEvent.pointerDown(board, { pointerId: 6, clientX: 150, clientY: 120 });
    fireEvent.pointerMove(board, { pointerId: 6, clientX: 160, clientY: 140 });
    fireEvent.pointerCancel(board, { pointerId: 6 });
    expect(label(first!)).toMatch(/in the tray$/);
    fireEvent.click(undoButton());
    expect(label(first!)).toMatch(/on the board$/);
  });

  it('lets one finger do everything: a second finger does nothing (§4)', async () => {
    await startEasy();
    const [x, y] = layoutOf(square).cells.L1;
    fireEvent.pointerDown(piece('L1'), { pointerId: 1, isPrimary: true, clientX: x, clientY: y });
    fireEvent.pointerDown(piece('M'), {
      pointerId: 2,
      isPrimary: false,
      clientX: 200,
      clientY: 330,
    });
    fireEvent.pointerMove(piece('M'), { pointerId: 2, clientX: 150, clientY: 100 });
    expect(document.querySelector('.tn-carry')).toBeNull();
    fireEvent.pointerUp(piece('M'), { pointerId: 2, clientX: 150, clientY: 100 });
    fireEvent.click(piece('M'), { detail: 1 });
    expect(label('M')).toMatch(/turned 0°/);
    // The buttons wait while the first finger is down.
    expect(undoButton()).toBeDisabled();
    fireEvent.pointerUp(piece('L1'), { pointerId: 1, clientX: x, clientY: y });
    fireEvent.click(piece('L1'), { detail: 1 });
    expect(label('L1')).toMatch(/turned 45°/);
  });

  it('lets a new primary pointer replace a press whose release went missing, recording nothing for it', async () => {
    await startEasy();
    const [first] = dragPlan(square);
    const target = square.solution[first!];
    orientInTray(first!, target);
    dragFromTray(square, first!, fingerFor(square, first!, target));
    expect(label(first!)).toMatch(/on the board$/);

    // A board piece carried off the silhouette; its release never arrives.
    const board = piece(first!);
    fireEvent.pointerDown(board, { pointerId: 1, isPrimary: true, clientX: 150, clientY: 120 });
    fireEvent.pointerMove(board, { pointerId: 1, isPrimary: true, clientX: 2, clientY: 2 });
    expect(document.querySelector('.tn-carry-open')).not.toBeNull();
    expect(undoButton()).toBeDisabled();
    expect(rotateButton()).toBeDisabled();

    // The next primary press works: the stranded one is dropped with no operation.
    const [mx, my] = layoutOf(square).cells.M;
    fireEvent.pointerDown(piece('M'), { pointerId: 2, isPrimary: true, clientX: mx, clientY: my });
    expect(document.querySelector('.tn-carry')).toBeNull();
    fireEvent.pointerUp(piece('M'), { pointerId: 2, isPrimary: true, clientX: mx, clientY: my });
    fireEvent.click(piece('M'), { detail: 1 });
    expect(label('M')).toBe('Medium triangle, turned 45°, in the tray');
    expect(label(first!)).toMatch(/on the board$/);
    expect(rotateButton()).toBeEnabled();
    expect(undoButton()).toBeEnabled();
    // The lost release, should it turn up, is ignored.
    fireEvent.pointerUp(board, { pointerId: 1, clientX: 2, clientY: 2 });
    expect(label(first!)).toMatch(/on the board$/);
    // The history holds the placement and M's turn, and nothing from the stranded press.
    fireEvent.click(undoButton());
    expect(label('M')).toMatch(/turned 0°/);
    fireEvent.click(undoButton());
    expect(label(first!)).toMatch(/in the tray$/);
  });

  it('abandons a press whose pointer capture is lost before any release (§4)', async () => {
    await startEasy();
    const [first] = dragPlan(square);
    const target = square.solution[first!];
    orientInTray(first!, target);
    dragFromTray(square, first!, fingerFor(square, first!, target));
    await settle();
    const before = savedGame()!.pieces[first!];

    const board = piece(first!);
    fireEvent.pointerDown(board, { pointerId: 3, clientX: 150, clientY: 120 });
    fireEvent.pointerMove(board, { pointerId: 3, clientX: 2, clientY: 2 });
    // Another pointer's capture going says nothing about this press.
    fireEvent.lostPointerCapture(board, { pointerId: 9 });
    expect(document.querySelector('.tn-carry')).not.toBeNull();
    fireEvent.lostPointerCapture(board, { pointerId: 3 });
    expect(document.querySelector('.tn-carry')).toBeNull();
    expect(undoButton()).toBeEnabled();
    // A release and a click that still arrive do nothing.
    fireEvent.pointerUp(board, { pointerId: 3, clientX: 2, clientY: 2 });
    fireEvent.click(board, { detail: 1 });
    expect(label(first!)).toMatch(new RegExp(`turned ${target.r * 45}°, on the board$`));
    await settle();
    expect(savedGame()!.pieces[first!]).toEqual(before);
  });

  it('makes only the polygon pressable, never the piece’s box (§10)', () => {
    // jsdom does no hit testing, so this reads the rule that makes a browser do it.
    const css = readFileSync(resolve('src/games/tangram/ui/tangram.css'), 'utf8');
    expect(css).toMatch(/\.tn-piece \{[^}]*pointer-events: none;/);
    expect(css).toMatch(/\.tn-shape \{[^}]*pointer-events: auto;/);
    expect(css).toMatch(/\.tn-play \{[^}]*touch-action: none;/);
  });

  it('stacks each piece face, grain, pressable edge, ring, its grain the board’s one tile (§10)', async () => {
    // Two faults a player would hardly see, as the face stays opaque: a child
    // inside a piece's pattern replaces the inherited tile (the grain is
    // gone), and a grain above `.tn-shape` lies over the pressable edge and
    // the inner half of the selection's line. Read on a tray piece and a
    // placed one.
    taughtAlready();
    suspend(placePiece(createSession(square), 'S2', sol(square, 'S2'))!);
    launch();
    await settle();
    fireEvent.click(button(/^Resume/));
    await settle();
    expect(label('S2')).toMatch(/on the board$/);
    const tiles = document.querySelectorAll('.tn-board-svg > defs > pattern');
    expect(tiles).toHaveLength(1);
    const tile = tiles[0]!;
    expect(tile.id).not.toBe('');
    expect(tile.children).toHaveLength(5);
    expect(tile.querySelectorAll(':scope > path.tn-grain-line')).toHaveLength(5);
    const patternIds = new Set<string>([tile.id]);
    for (const id of PIECE_IDS) {
      const svg = piece(id).querySelector('svg')!;
      expect(
        [...svg.children].map((el) => el.getAttribute('class') ?? el.tagName.toLowerCase()),
        id,
      ).toEqual(['defs', 'tn-face', 'tn-grain', 'tn-shape', 'tn-ring']);
      const own = svg.querySelectorAll('defs > pattern');
      expect(own, id).toHaveLength(1);
      const pattern = own[0]!;
      expect(pattern.getAttribute('href'), id).toBe(`#${tile.id}`);
      expect(pattern.childElementCount, id).toBe(0);
      expect(svg.querySelector('.tn-grain')!.getAttribute('fill'), id).toBe(`url(#${pattern.id})`);
      expect(patternIds.has(pattern.id), `${id}'s pattern id is unique`).toBe(false);
      patternIds.add(pattern.id);
    }
    // Only the edge takes a press: the layers over and under it let it through.
    const css = readFileSync(resolve('src/games/tangram/ui/tangram.css'), 'utf8');
    for (const layer of ['tn-face', 'tn-grain', 'tn-ring']) {
      expect(css).toMatch(new RegExp(`\\.${layer} \\{[^}]*pointer-events: none;`));
    }
  });
});

describe('the three buttons (§4)', () => {
  it('turns the selected tray piece, flips only the parallelogram, and undoes', async () => {
    await startEasy();
    expect(rotateButton()).toBeDisabled();
    expect(flipButton()).toBeDisabled();
    // Selecting by a press (no click): Rotate wakes, Flip stays off for a triangle.
    fireEvent.pointerDown(piece('S1'), { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(piece('S1'), { pointerId: 1, clientX: 0, clientY: 0 });
    expect(rotateButton()).toBeEnabled();
    expect(flipButton()).toBeDisabled();
    fireEvent.click(rotateButton());
    expect(label('S1')).toMatch(/turned 45°/);

    fireEvent.pointerDown(piece('P'), { pointerId: 2, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(piece('P'), { pointerId: 2, clientX: 0, clientY: 0 });
    expect(flipButton()).toBeEnabled();
    fireEvent.click(flipButton());
    expect(label('P')).toBe('Parallelogram, turned 0°, flipped, in the tray');
    fireEvent.click(undoButton());
    expect(label('P')).toBe('Parallelogram, turned 0°, in the tray');
  });

  it('turns a placed piece about its pivot with the Rotate button (§4)', async () => {
    taughtAlready();
    suspend(placePiece(createSession(square), 'S2', sol(square, 'S2'))!);
    launch();
    await settle();
    fireEvent.click(button(/^Resume/));
    await settle();
    const before = savedGame()!.pieces.S2!;
    expect(label('S2')).toBe(`Small triangle 2, turned ${before.r * 45}°, on the board`);
    fireEvent.pointerDown(piece('S2'), { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(piece('S2'), { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.click(rotateButton());
    expect(label('S2')).toBe(`Small triangle 2, turned ${(before.r + 1) * 45}°, on the board`);
    await settle();
    const after = savedGame()!.pieces.S2!;
    // The pose turned; the pivot stayed put and is still one of the piece's points.
    expect(after.r).toBe(before.r + 1);
    expect(after.pv).toEqual(before.pv);
    const at = after.at as Placement['at'];
    const vertices = poseVertices('S2', { r: after.r, f: after.f, at } as Pose).map((v) =>
      JSON.stringify(v),
    );
    expect(vertices).toContain(JSON.stringify(after.pv));
    fireEvent.click(undoButton());
    expect(label('S2')).toBe(`Small triangle 2, turned ${before.r * 45}°, on the board`);
  });

  it('shows Medium’s two fixed pieces fixed: selectable, never moved (§3)', async () => {
    taughtAlready();
    launch();
    await settle();
    fireEvent.click(button(/^Medium/));
    await settle();
    const medium = figuresOf('medium')[0]!;
    expect(screen.getByText('Medium 1')).toBeInTheDocument();
    for (const id of medium.fixed) {
      expect(label(id)).toMatch(/fixed in place$/);
      fireEvent.pointerDown(piece(id), { pointerId: 1, clientX: 0, clientY: 0 });
      fireEvent.pointerMove(piece(id), { pointerId: 1, clientX: 90, clientY: 90 });
      fireEvent.pointerUp(piece(id), { pointerId: 1, clientX: 90, clientY: 90 });
      fireEvent.click(piece(id), { detail: 1 });
      expect(piece(id)).toHaveAttribute('aria-pressed', 'true');
      expect(rotateButton()).toBeDisabled();
      expect(label(id)).toMatch(/fixed in place$/);
    }
    expect(undoButton()).toBeDisabled();
    expect(document.querySelectorAll('.tn-guide')).toHaveLength(0);
  });
});

describe('the keyboard (§4「キーボード」)', () => {
  /** The arrows from the tray lift point to where the snap lands on `target`. */
  function arrowsTo(session: TangramSession, id: PieceId, target: Pose): [number, number] | null {
    const goal = centroidOf(id, target);
    const start = outlineCenter(session.figure.outline);
    const dx0 = Math.round(goal[0] - start[0]);
    const dy0 = Math.round(goal[1] - start[1]);
    for (let ex = -1; ex <= 1; ex++) {
      for (let ey = -1; ey <= 1; ey++) {
        let point = start;
        const nx = dx0 + ex;
        const ny = dy0 + ey;
        for (let k = 0; k < Math.abs(nx); k++) point = stepPoint(point, Math.sign(nx), 0);
        for (let k = 0; k < Math.abs(ny); k++) point = stepPoint(point, 0, Math.sign(ny));
        const out = keyboardSnap(session.figure.outline, session.board, id, target, point);
        if (out.placement && samePose(out.placement, target)) return [nx, ny];
      }
    }
    return null;
  }

  /** Tab, forward, until `id` has the focus (wrapping round the page if need be). */
  async function tabTo(user: ReturnType<typeof userEvent.setup>, id: PieceId) {
    for (let k = 0; k < 24 && document.activeElement !== piece(id); k++) await user.tab();
    expect(document.activeElement).toBe(piece(id));
  }

  it('walks the seven pieces with Tab, in order, after the top bar', async () => {
    const user = userEvent.setup();
    await startEasy();
    act(() => button('Retry same board').focus());
    for (const id of PIECE_IDS) {
      await user.tab();
      expect(document.activeElement).toBe(piece(id));
    }
    expect(piece('S2')).toHaveAttribute('aria-pressed', 'true');
  });

  it('completes the square with Tab, R, F, arrows and Enter alone', async () => {
    const user = userEvent.setup();
    await startEasy();
    let session = createSession(square);
    const left = [...PIECE_IDS];
    while (left.length > 0) {
      const index = left.findIndex((id) => arrowsTo(session, id, square.solution[id]) !== null);
      expect(index).toBeGreaterThanOrEqual(0);
      const id = left.splice(index, 1)[0]!;
      const target = square.solution[id];
      await tabTo(user, id);
      for (let k = 0; k < target.r; k++) key('r');
      if (target.f === 1) key('f');
      const [nx, ny] = arrowsTo(session, id, target)!;
      key('Enter');
      expect(live()).toMatch(/lifted/);
      for (let k = 0; k < Math.abs(nx); k++) key(nx > 0 ? 'ArrowRight' : 'ArrowLeft');
      for (let k = 0; k < Math.abs(ny); k++) key(ny > 0 ? 'ArrowDown' : 'ArrowUp');
      if (nx !== 0 || ny !== 0) expect(live()).toMatch(/^Fits, on/);
      key('Enter');
      expect(label(id)).toMatch(/on the board$/);
      if (left.length > 0) expect(document.activeElement).toBe(piece(id));
      session = placePiece(session, id, { ...target, pv: target.at })!;
    }
    expect(resultCard()).toBeInTheDocument();
  });

  it('carries a lifted piece without touching the session; Escape leaves a tray piece in the tray', async () => {
    const user = userEvent.setup();
    await startEasy();
    act(() => piece('L1').focus());
    key('Enter');
    expect(document.querySelector('.tn-carry')).not.toBeNull();
    // R and F turn what is carried, not the piece (F does nothing to a triangle).
    key('r');
    expect(label('L1')).toMatch(/turned 0°/);
    // Tab stays put: its default is prevented, and a real Tab moves nothing.
    expect(fireEvent.keyDown(piece('L1'), { key: 'Tab' })).toBe(false);
    await user.tab();
    expect(document.activeElement).toBe(piece('L1'));
    expect(document.querySelector('.tn-carry')).not.toBeNull();
    key('Escape');
    expect(document.querySelector('.tn-carry')).toBeNull();
    expect(label('L1')).toBe('Large triangle 1, turned 0°, in the tray');
    expect(undoButton()).toBeDisabled();
  });

  it('sends a piece lifted from the board to the tray with Escape — one operation, its turn from before the lift', async () => {
    await startEasy();
    solveByDragging(square, 1);
    const [first] = dragPlan(square);
    const target = square.solution[first!];
    await settle();
    const before = savedGame()!.pieces[first!];
    expect(before).toBeDefined();
    act(() => piece(first!).focus());
    key('Enter');
    key('r');
    key('r');
    key('Escape');
    expect(document.querySelector('.tn-carry')).toBeNull();
    // The two turns made while lifted are dropped (§4).
    expect(label(first!)).toMatch(new RegExp(`, turned ${target.r * 45}°, in the tray$`));
    await settle();
    expect(savedGame()!.pieces[first!]).toBeUndefined();
    // One operation: Undo puts it back where it stood.
    fireEvent.click(undoButton());
    expect(label(first!)).toMatch(new RegExp(`, turned ${target.r * 45}°, on the board$`));
    await settle();
    expect(savedGame()!.pieces[first!]).toEqual(before);
  });

  it('answers no Ctrl/Cmd+Z while a piece is lifted or a finger is down (§4)', async () => {
    await startEasy();
    solveByDragging(square, 1);
    const [first] = dragPlan(square);
    const other = PIECE_IDS.find((id) => id !== first)!;
    act(() => piece(other).focus());
    key('Enter');
    key('z', { ctrlKey: true });
    key('z', { metaKey: true });
    expect(label(first!)).toMatch(/on the board$/);
    key('Escape');
    fireEvent.pointerDown(piece(other), { pointerId: 1, clientX: 0, clientY: 0 });
    key('z', { ctrlKey: true });
    expect(label(first!)).toMatch(/on the board$/);
    fireEvent.pointerUp(piece(other), { pointerId: 1, clientX: 0, clientY: 0 });
    // Nothing in the hand: the same key undoes.
    key('z', { ctrlKey: true });
    expect(label(first!)).toMatch(/in the tray$/);
  });

  it('says whether a lifted piece fits and on what — never where (§10)', async () => {
    await startEasy();
    act(() => piece('S1').focus());
    key('Enter');
    expect(live()).toBe(
      'Small triangle 1 lifted. Arrow keys move it, Enter places it, Escape returns it to the tray.',
    );
    for (let k = 0; k < 12; k++) key('ArrowLeft', { repeat: k > 0 });
    expect(live()).toBe('Does not fit here');
    // Enter with nowhere to snap leaves it lifted.
    key('Enter');
    expect(document.querySelector('.tn-carry-open')).not.toBeNull();
    // Back to two left of where it was lifted, and two up: the silhouette's top-left corner.
    for (let k = 0; k < 10; k++) key('ArrowRight');
    key('ArrowUp');
    key('ArrowUp');
    expect(live()).toBe('Fits, on a corner of the silhouette');
    key('Enter');
    expect(label('S1')).toBe('Small triangle 1, turned 0°, on the board');
  });

  it('turns, flips, puts back and undoes without lifting, and ignores a held key', async () => {
    await startEasy();
    act(() => piece('P').focus());
    key('r');
    key('r', { repeat: true });
    key('f');
    expect(label('P')).toBe('Parallelogram, turned 45°, flipped, in the tray');
    key('z', { ctrlKey: true });
    expect(label('P')).toBe('Parallelogram, turned 45°, in the tray');
    key('z', { metaKey: true, repeat: true });
    expect(label('P')).toBe('Parallelogram, turned 45°, in the tray');

    // Escape sends a focused board piece to the tray.
    solveByDragging(square, 1);
    const [first] = dragPlan(square);
    act(() => piece(first!).focus());
    key('Escape');
    expect(label(first!)).toMatch(/in the tray$/);
  });
});

describe('the result card and the ↻ (§6, §7)', () => {
  it('states the completion, the figure and the time, and leads to the next figure', async () => {
    await startEasy();
    solveByDragging(square);
    const card = resultCard()!;
    expect(card).toBeInTheDocument();
    expect(within(card).getByText('Easy 1')).toBeInTheDocument();
    expect(within(card).getByText('0:00')).toBeInTheDocument();
    expect(within(card).queryByText(/Nice work/)).toBeNull();
    // Inert behind the card: the pieces answer no keys.
    expect(document.querySelector('.game-content')).toHaveAttribute('inert');
    expect(within(card).getByRole('button', { name: 'Next figure' })).toHaveFocus();
    expect(within(card).getByRole('button', { name: 'Retry same board' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Share' })).toBeInTheDocument();
    await settle();
    expect(savedGame()).toBeNull();
    expect(savedStats()!.easy).toMatchObject({ played: 1, solved: 1 });
    expect(savedProgress()!.best).toEqual({ square: 0 });

    fireEvent.click(within(card).getByRole('button', { name: 'Next figure' }));
    await settle();
    expect(screen.getByText('Easy 2')).toBeInTheDocument();
    expect(savedProgress()!.last).toEqual({ easy: 'triangle' });
    expect(savedStats()!.easy.played).toBe(2);
    // The focus lands on the first piece, the card's button being gone (§4).
    expect(document.activeElement).toBe(piece('L1'));
  });

  it('adds the signed difference from the record from the second completion on (§7)', async () => {
    taughtAlready();
    put(TN_STORAGE_KEYS.progress, { schemaVersion: 1, best: { square: 95 }, last: {} });
    suspend(createSession(square));
    launch();
    await settle();
    fireEvent.click(button(/^Resume/));
    solveByDragging(square);
    expect(within(resultCard()!).getByText('−1:35')).toBeInTheDocument();
  });

  it('asks ↻ through the shared dialog, with the retry alone, and starts the figure over', async () => {
    await startEasy();
    solveByDragging(square, 2);
    fireEvent.click(button('Retry same board'));
    const dialog = screen.getByRole('alertdialog', { name: 'Start over?' });
    expect(within(dialog).queryByRole('button', { name: /New/ })).toBeNull();
    expect(document.querySelector('.game-content')).toHaveAttribute('inert');
    // The board answers no key behind the dialog (§4): no Undo, no turn.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(piece('M'), { key: 'r' });
    expect(document.querySelectorAll('.tn-piece-placed')).toHaveLength(2);
    expect(label('M')).toMatch(/turned 0°/);
    // Escape is Cancel.
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.querySelectorAll('.tn-piece-placed')).toHaveLength(2);

    fireEvent.click(button('Retry same board'));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Retry same board' }),
    );
    await settle();
    expect(document.querySelectorAll('.tn-piece-placed')).toHaveLength(0);
    expect(undoButton()).toBeDisabled();
    expect(savedStats()!.easy.played).toBe(2);
    expect(savedGame()!.pieces).toEqual({});
  });

  it('offers a completed daily its retry and the home, nothing else', async () => {
    taughtAlready();
    launch();
    await settle();
    fireEvent.click(button(/^Daily Challenge/));
    await settle();
    const figure = dailyFigure(TODAY)!;
    expect(screen.getByRole('img', { name: `Silhouette: Daily, ${TODAY}` })).toBeInTheDocument();
    solveByDragging(figure);
    const card = resultCard()!;
    expect(within(card).getByText(`Daily, ${TODAY}`)).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Next figure' })).toBeNull();
    expect(within(card).getByRole('button', { name: 'Retry same board' })).toHaveFocus();
    await settle();
    expect(savedDaily()).toBeNull();
    const stats = savedStats()!;
    expect(stats.daily.played).toBe(1);
    expect(stats.dailyTimes[TODAY]).toBe(0);
    expect(stats.medium).toMatchObject({ played: 0, solved: 0 });
    // The daily never moves Medium's place in its list.
    expect(savedProgress()?.last.medium).toBeUndefined();

    fireEvent.click(within(card).getByRole('button', { name: 'Home' }));
    expect(button(/^Daily Challenge/)).toHaveTextContent('Completed today');
  });
});

describe('the home (§6)', () => {
  it('leads with the tier chosen last, and asks before replacing a figure in progress', async () => {
    taughtAlready();
    put(TN_STORAGE_KEYS.prefs, { schemaVersion: 1, tier: 'hard' });
    launch();
    await settle();
    expect(button(/^Hard/)).toHaveClass('btn-primary');
    expect(button(/^Easy/)).toHaveClass('btn-secondary');
    fireEvent.click(button(/^Easy/));
    await settle();
    solveByDragging(square, 1);
    fireEvent.click(button('Home'));
    await settle();
    expect(read(TN_STORAGE_KEYS.prefs)).toEqual({ schemaVersion: 1, tier: 'easy' });

    // A figure in progress: Resume leads and names it.
    expect(button(/^Resume/)).toHaveTextContent('Easy 1');
    expect(button(/^Resume/)).toHaveClass('btn-primary');
    fireEvent.click(button(/^Hard/));
    const dialog = screen.getByRole('alertdialog', { name: 'Replace the figure in progress?' });
    expect(dialog).toHaveTextContent('Easy 1 will be replaced by Hard 1.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(savedGame()!.figure).toBe('square');
    // Escape is Cancel too.
    fireEvent.click(button(/^Hard/));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await settle();
    expect(savedGame()!.figure).toBe('square');
    expect(button(/^Resume/)).toHaveTextContent('Easy 1');

    // The same tier replaces too, with the next figure (§6).
    fireEvent.click(button(/^Easy/));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Easy 1 will be replaced by Easy 2.');
    fireEvent.click(button('Start'));
    await settle();
    expect(screen.getByText('Easy 2')).toBeInTheDocument();
    expect(savedGame()!.figure).toBe('triangle');
    expect(savedStats()!.easy.played).toBe(2);
  });

  it('resumes today’s daily without a question, and keeps the Free Play figure apart', async () => {
    taughtAlready();
    suspend(placePiece(createSession(square), 'L1', sol(square, 'L1'))!);
    const figure = dailyFigure(TODAY)!;
    const daily = createSession(figure, 'daily', TODAY);
    suspend(daily);
    launch();
    await settle();
    expect(button(/^Daily Challenge/)).toHaveTextContent('Resume');
    fireEvent.click(button(/^Daily Challenge/));
    await settle();
    expect(screen.getByText('Daily')).toBeInTheDocument();
    expect(savedStats()?.daily.played ?? 0).toBe(0);
    fireEvent.click(button('Home'));
    fireEvent.click(button(/^Resume/));
    expect(screen.getByText('Easy 1')).toBeInTheDocument();
    expect(label('L1')).toMatch(/on the board$/);
  });

  it('shows the statistics without a streak or an "n of N"', async () => {
    taughtAlready();
    put(TN_STORAGE_KEYS.stats, {
      schemaVersion: 1,
      easy: { played: 5, solved: 3, totalPlaySeconds: 610 },
      medium: { played: 2, solved: 1, totalPlaySeconds: 420 },
      hard: { played: 0, solved: 0, totalPlaySeconds: 0 },
      daily: { played: 2, totalPlaySeconds: 380 },
      dailyTimes: { '2026-10-21': 185 },
    });
    put(TN_STORAGE_KEYS.progress, {
      schemaVersion: 1,
      best: { square: 95, triangle: 140, corner: 300 },
      last: {},
    });
    launch();
    await settle();
    fireEvent.click(button('Statistics'));
    const easy = screen.getByRole('heading', { name: 'Easy' }).closest('section')!;
    expect(within(easy).getByText('Figures started').nextSibling).toHaveTextContent('5');
    expect(within(easy).getByText('Figures completed').nextSibling).toHaveTextContent('3');
    expect(within(easy).getByText('Different figures completed').nextSibling).toHaveTextContent(
      '2',
    );
    expect(within(easy).getByText('Total play time').nextSibling).toHaveTextContent('10:10');
    const daily = screen.getByRole('heading', { name: 'Daily Challenge' }).closest('section')!;
    expect(within(daily).getByText('Days completed').nextSibling).toHaveTextContent('1');
    const all = screen.getByRole('heading', { name: 'All play' }).closest('section')!;
    expect(within(all).getByText('Total play time').nextSibling).toHaveTextContent('23:30');
    expect(screen.queryByText(/streak/i)).toBeNull();
    expect(screen.queryByText(/\d+ \/ \d+/)).toBeNull();
  });
});

describe('the saved figures (§8)', () => {
  it('opens on the game’s home, with nothing started, when a save is damaged', async () => {
    taughtAlready();
    deviceStore.set(
      TN_STORAGE_KEYS.game,
      JSON.stringify({ schemaVersion: 1, mode: 'free', figure: 'nope' }),
    );
    launch();
    await settle();
    expect(screen.queryByRole('button', { name: /^Resume/ })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Tangram' })).toBeInTheDocument();
    // Left where it was; the next figure in the slot replaces it.
    expect(deviceStore.get(TN_STORAGE_KEYS.game)).toContain('nope');
  });

  it('saves a piece in the hand where it was before it was lifted when the page goes hidden', async () => {
    await startEasy();
    solveByDragging(square, 1);
    const [first] = dragPlan(square);
    await settle();
    const before = savedGame()!.pieces[first!];
    const el = piece(first!);
    fireEvent.pointerDown(el, { pointerId: 8, clientX: 150, clientY: 120 });
    fireEvent.pointerMove(el, { pointerId: 8, clientX: 2, clientY: 2 });
    background();
    await settle();
    expect(savedGame()!.pieces[first!]).toEqual(before);
    expect(document.querySelector('.tn-carry')).toBeNull();
    // Whatever the finger does afterwards is ignored (ARCHITECTURE.md「押下の記録は誰のものか」).
    fireEvent.pointerUp(el, { pointerId: 8, clientX: 2, clientY: 2 });
    fireEvent.click(el, { detail: 1 });
    expect(label(first!)).toMatch(/on the board$/);
    expect(label(first!)).toMatch(new RegExp(`turned ${square.solution[first!].r * 45}°`));

    // A keyboard lift is abandoned the same way: nothing drawn, nothing saved,
    // and the arrows move nothing afterwards.
    act(() => piece(first!).focus());
    key('Enter');
    for (let k = 0; k < 6; k++) key('ArrowLeft');
    expect(document.querySelector('.tn-carry')).not.toBeNull();
    background();
    await settle();
    expect(document.querySelector('.tn-carry')).toBeNull();
    expect(savedGame()!.pieces[first!]).toEqual(before);
    key('ArrowLeft');
    expect(document.querySelector('.tn-carry')).toBeNull();
    expect(label(first!)).toMatch(/on the board$/);
    expect(undoButton()).toBeEnabled();

    // And so is one Home takes off screen.
    act(() => piece(first!).focus());
    key('Enter');
    for (let k = 0; k < 6; k++) key('ArrowLeft');
    fireEvent.click(button('Home'));
    await settle();
    expect(savedGame()!.pieces[first!]).toEqual(before);
    fireEvent.click(button(/^Resume/));
    expect(document.querySelector('.tn-carry')).toBeNull();
    expect(label(first!)).toMatch(/on the board$/);
  });

  it('saves a piece in the hand where it was when the game unmounts mid-drag', async () => {
    await startEasy();
    solveByDragging(square, 1);
    const [first] = dragPlan(square);
    await settle();
    const before = savedGame()!.pieces[first!];
    fireEvent.pointerDown(piece(first!), { pointerId: 9, clientX: 150, clientY: 120 });
    fireEvent.pointerMove(piece(first!), { pointerId: 9, clientX: 3, clientY: 3 });
    cleanup();
    await settle();
    expect(savedGame()!.pieces[first!]).toEqual(before);
  });

  it('saves on the background with the play time, and books it once (§7)', async () => {
    taughtAlready();
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(button(/^Easy/));
      act(() => vi.advanceTimersByTime(7_000));
      background();
      await settle();
      expect(savedGame()!.elapsedSeconds).toBe(7);
      expect(savedStats()!.easy.totalPlaySeconds).toBe(7);

      // Hidden time is not play time.
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      act(() => vi.advanceTimersByTime(60_000));
      Reflect.deleteProperty(document, 'visibilityState');
      act(() => vi.advanceTimersByTime(3_000));
      // The browser's Back unmounts the Root: the three seconds are booked once.
      cleanup();
      await settle();
      expect(savedGame()!.elapsedSeconds).toBe(10);
      expect(savedStats()!.easy.totalPlaySeconds).toBe(10);
      launch();
      await settle();
      cleanup();
      await settle();
      expect(savedStats()!.easy.totalPlaySeconds).toBe(10);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('a home-screen shortcut (§8, issue #113)', () => {
  it('opens straight onto the one suspended figure', async () => {
    taughtAlready();
    suspend(placePiece(createSession(triangle), 'S1', sol(triangle, 'S1'))!);
    launch('shortcut');
    await settle();
    expect(screen.getByText('Easy 2')).toBeInTheDocument();
    expect(label('S1')).toMatch(/on the board$/);
  });

  it('opens the home when both slots hold a figure, and Quick Rules on a first launch', async () => {
    taughtAlready();
    suspend(createSession(triangle));
    suspend(createSession(dailyFigure(TODAY)!, 'daily', TODAY));
    launch('shortcut');
    await settle();
    expect(screen.getByRole('heading', { level: 1, name: 'Tangram' })).toBeInTheDocument();
    cleanup();
    await settle();
    deviceStore.delete(TN_STORAGE_KEYS.flags);
    launch('shortcut');
    await settle();
    expect(screen.getByRole('heading', { level: 1, name: 'How to Play' })).toBeInTheDocument();
  });
});
