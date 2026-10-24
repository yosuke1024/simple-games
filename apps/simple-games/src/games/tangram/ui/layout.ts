/**
 * Where everything on the play area goes, in CSS pixels — the board, the
 * figure inside it, and the tray's seven cells (docs/TANGRAM_RULES.md §4,
 * §10). Pure arithmetic from the play area's measured size, so the screen,
 * the pointer mapping and the tests all read the same numbers.
 *
 * The play area is the column between the top bar and the action bar. The
 * tray takes two rows at the bottom (L1 L2 M P / SQ S1 S2, §5), sized so each
 * cell holds its piece in any of the eight turns; the board is the largest
 * square the rest leaves, and the figure's bounding box is fitted inside its
 * `BOARD_MARGIN_PX`. On a tablet or a desktop the board grows with the room
 * (to `BOARD_MAX_PX`) and stays square (§10).
 */
import { orientedShape, ptToFloat, type Orientation, type PieceId, type Pt } from '../game';

/** Snap reach on screen (§4 の表). Capped at the keyboard's one unit — see `pointerTolerance`. */
export const SNAP_PX = 14;
/** A press that travels no further than this is a tap (§4). */
export const TAP_SLOP_PX = 6;
/** A piece carried from the tray floats this far above the finger (§4). */
export const TRAY_LIFT_PX = 24;
/** The figure's bounding box keeps this far inside the board (§4 の表, §10). */
export const BOARD_MARGIN_PX = 16;
/** The play area's side gutter. */
export const GUTTER_PX = 16;
/** Between the board and the tray. */
export const TRAY_GAP_PX = 8;
/** The board never grows past this on a large screen. */
export const BOARD_MAX_PX = 560;
/**
 * Nor shrinks below this. A play area shorter than 240 px (the web build on
 * a phone held sideways — the apps are portrait-only) then pushes the tray
 * past `.tn-play`'s `overflow: hidden`, and
 * at 168 px or less the whole tray is gone: a known limit, not reflowed —
 * docs/TANGRAM_RULES.md §13「横持ちと低い画面」, pinned in layout.test.ts.
 */
export const BOARD_MIN_PX = 160;
/** At most this share of the play area's height goes to the tray. */
export const TRAY_SHARE = 0.3;
/** The tray's scale never passes this, so a tablet's tray stays a tray. */
export const TRAY_MAX_PPU = 16;
/** Room around a piece inside its tray cell, in units. */
export const TRAY_PAD_UNITS = 0.6;

/** What the layout falls back to when the play area cannot be measured (jsdom, a hidden tab). */
export const DEFAULT_PLAY_SIZE = { width: 360, height: 391 } as const;

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface PlayLayout {
  readonly width: number;
  readonly height: number;
  /** The board square, in play-area pixels. */
  readonly board: Box;
  /** Pixels per unit on the board. */
  readonly ppu: number;
  /** Where the unit point (0, 0) lands, in play-area pixels. */
  readonly originX: number;
  readonly originY: number;
  /** The tray's background, in play-area pixels. */
  readonly tray: Box;
  /** Pixels per unit in the tray. */
  readonly trayPpu: number;
  /** Each piece's tray cell centre, in play-area pixels. */
  readonly cells: Readonly<Record<PieceId, readonly [x: number, y: number]>>;
}

const R2 = Math.SQRT2;
/** The widest a piece gets in any of its turns, in units (a cell holds it whichever way it faces). */
const PIECE_EXTENT: Readonly<Record<PieceId, number>> = {
  L1: 4 * R2,
  L2: 4 * R2,
  M: 4,
  P: 3 * R2,
  SQ: 2 * R2,
  S1: 2 * R2,
  S2: 2 * R2,
};
const ROW1: readonly PieceId[] = ['L1', 'L2', 'M', 'P'];
const ROW2: readonly PieceId[] = ['SQ', 'S1', 'S2'];
const cellUnits = (id: PieceId) => PIECE_EXTENT[id] + TRAY_PAD_UNITS;
const ROW1_WIDTH = ROW1.reduce((sum, id) => sum + cellUnits(id), 0);
const ROW1_HEIGHT = Math.max(...ROW1.map(cellUnits));
const ROW2_HEIGHT = Math.max(...ROW2.map(cellUnits));

/** The figure's bounding box in units (its top left is the origin, §2). */
export function figureExtent(outline: readonly Pt[]): { w: number; h: number } {
  const points = outline.map(ptToFloat);
  return {
    w: Math.max(...points.map((p) => p[0])) - Math.min(...points.map((p) => p[0])),
    h: Math.max(...points.map((p) => p[1])) - Math.min(...points.map((p) => p[1])),
  };
}

export function playLayout(width: number, height: number, outline: readonly Pt[]): PlayLayout {
  const inner = Math.max(0, width - 2 * GUTTER_PX);
  const trayPpu = Math.min(
    TRAY_MAX_PPU,
    inner / ROW1_WIDTH,
    (height * TRAY_SHARE) / (ROW1_HEIGHT + ROW2_HEIGHT),
  );
  const trayH = (ROW1_HEIGHT + ROW2_HEIGHT) * trayPpu;
  const side = Math.max(BOARD_MIN_PX, Math.min(BOARD_MAX_PX, inner, height - trayH - TRAY_GAP_PX));
  const board: Box = { x: (width - side) / 2, y: 0, w: side, h: side };

  const { w, h } = figureExtent(outline);
  const ppu = (side - 2 * BOARD_MARGIN_PX) / Math.max(w, h);
  const originX = board.x + (side - w * ppu) / 2;
  const originY = board.y + (side - h * ppu) / 2;

  const trayW = ROW1_WIDTH * trayPpu;
  const tray: Box = { x: (width - trayW) / 2, y: side + TRAY_GAP_PX, w: trayW, h: trayH };
  const cells = {} as Record<PieceId, readonly [number, number]>;
  let x = tray.x;
  for (const id of ROW1) {
    const cw = cellUnits(id) * trayPpu;
    cells[id] = [x + cw / 2, tray.y + (ROW1_HEIGHT * trayPpu) / 2];
    x += cw;
  }
  const cw2 = trayW / ROW2.length;
  ROW2.forEach((id, i) => {
    cells[id] = [tray.x + cw2 * (i + 0.5), tray.y + (ROW1_HEIGHT + ROW2_HEIGHT / 2) * trayPpu];
  });
  return { width, height, board, ppu, originX, originY, tray, trayPpu, cells };
}

/**
 * The pointer's snap reach in units: `SNAP_PX` on this board, never more than
 * the keyboard's one unit. Phase 2 measured the snap's work with reaches up
 * to one unit (§5「範囲と仕事量」); a board small enough to stretch 14 px past
 * one unit — the web build's ad reserve on a small phone, a large figure —
 * stays inside what was measured.
 */
export function pointerTolerance(ppu: number, keyboardTolerance: number): number {
  return ppu > 0 ? Math.min(SNAP_PX / ppu, keyboardTolerance) : keyboardTolerance;
}

/** A piece's vertices in play-area pixels, given unit vertices and the board mapping. */
export function boardPixels(layout: PlayLayout, vertices: readonly Pt[]): [number, number][] {
  return vertices.map((v) => {
    const [x, y] = ptToFloat(v);
    return [layout.originX + x * layout.ppu, layout.originY + y * layout.ppu];
  });
}

/** A tray piece's vertices in play-area pixels: its current turn, centred in its cell. */
export function trayPixels(layout: PlayLayout, id: PieceId, o: Orientation): [number, number][] {
  const shape = orientedShape(id, o).map(ptToFloat);
  const xs = shape.map((p) => p[0]);
  const ys = shape.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const [x0, y0] = layout.cells[id];
  return shape.map(([x, y]) => [x0 + (x - cx) * layout.trayPpu, y0 + (y - cy) * layout.trayPpu]);
}

/** A play-area pixel as a board unit point. */
export const toUnits = (layout: PlayLayout, px: number, py: number): [number, number] => [
  (px - layout.originX) / layout.ppu,
  (py - layout.originY) / layout.ppu,
];

/** The bounding box of a pixel polygon. */
export function boundsOf(points: readonly (readonly [number, number])[]): Box {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
