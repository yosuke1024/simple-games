/**
 * The play area's arithmetic (docs/TANGRAM_RULES.md §10, §13). jsdom lays
 * nothing out, so what a real 360×640 screen gives the play area is worked
 * out here from the shell's measured parts rather than measured in a browser
 * (that is still to do — §13): the top bar (8 + 48 + 8 px), the action bar
 * (10 + 48 + 10 px and its 1 px rule), and in the web build the 116 px ad
 * reserve under every screen (`:root[data-sg-web-ads] .screen`).
 */
import { describe, expect, it } from 'vitest';
import { FIGURES, KEYBOARD_TOLERANCE, orientedShape, PIECE_IDS, ptToFloat, TURNS } from '../game';
import {
  BOARD_MARGIN_PX,
  DEFAULT_PLAY_SIZE,
  figureExtent,
  playLayout,
  pointerTolerance,
  SNAP_PX,
  trayPixels,
} from './layout';

const TOP_BAR = 64;
const ACTION_BAR = 69;
const WEB_AD_RESERVE = 116;
/** The play area on a 360×640 phone in the web build with ads — the tightest case named in §10. */
const WEB_PHONE = { width: 360, height: 640 - WEB_AD_RESERVE - TOP_BAR - ACTION_BAR };

describe('the play area on a 360×640 phone (§10)', () => {
  it('is what the screen falls back to when nothing can be measured', () => {
    expect(DEFAULT_PLAY_SIZE).toEqual(WEB_PHONE);
  });

  it('fits the board, the tray and the margins inside it, without scrolling', () => {
    for (const figure of FIGURES) {
      const layout = playLayout(WEB_PHONE.width, WEB_PHONE.height, figure.outline);
      expect(layout.board.x).toBeGreaterThanOrEqual(16);
      expect(layout.board.x + layout.board.w).toBeLessThanOrEqual(360 - 16);
      expect(layout.tray.y + layout.tray.h).toBeLessThanOrEqual(WEB_PHONE.height + 1e-9);
      expect(layout.tray.y).toBeGreaterThanOrEqual(layout.board.y + layout.board.h);
      // The figure inside the board's margin.
      const { w, h } = figureExtent(figure.outline);
      expect(layout.originX - layout.board.x).toBeGreaterThanOrEqual(BOARD_MARGIN_PX - 1e-9);
      expect(layout.originY - layout.board.y).toBeGreaterThanOrEqual(BOARD_MARGIN_PX - 1e-9);
      expect(layout.originX + w * layout.ppu).toBeLessThanOrEqual(
        layout.board.x + layout.board.w - BOARD_MARGIN_PX + 1e-9,
      );
      expect(layout.originY + h * layout.ppu).toBeLessThanOrEqual(
        layout.board.y + layout.board.h - BOARD_MARGIN_PX + 1e-9,
      );
    }
  });

  it('reports the sizes it comes to (printed, not gated beyond the floor)', () => {
    const layouts = FIGURES.map((figure) => ({
      id: figure.id,
      layout: playLayout(WEB_PHONE.width, WEB_PHONE.height, figure.outline),
    }));
    const board = layouts[0]!.layout.board.w;
    const legs = layouts.map(({ layout }) => 2 * layout.ppu);
    const smallest = Math.min(...legs);
    const trayLeg = 2 * layouts[0]!.layout.trayPpu;
    // Arithmetic, for docs/TANGRAM_RULES.md §10: the board side, the smallest
    // small-triangle leg on the board (the largest figure) and in the tray.
    console.info(
      `360×640 web: board ${board.toFixed(1)} px, board leg ≥ ${smallest.toFixed(1)} px, tray leg ${trayLeg.toFixed(1)} px`,
    );
    expect(board).toBeCloseTo(265.7, 1);
    expect(smallest).toBeGreaterThan(30);
    expect(trayLeg).toBeGreaterThan(20);
  });

  it('keeps each tray piece inside its cell whichever way it is turned', () => {
    const layout = playLayout(WEB_PHONE.width, WEB_PHONE.height, FIGURES[0]!.outline);
    for (const id of PIECE_IDS) {
      for (let r = 0; r < TURNS; r++) {
        for (const f of id === 'P' ? ([0, 1] as const) : ([0] as const)) {
          for (const [x, y] of trayPixels(layout, id, { r, f })) {
            expect(x).toBeGreaterThanOrEqual(layout.tray.x - 1e-9);
            expect(x).toBeLessThanOrEqual(layout.tray.x + layout.tray.w + 1e-9);
            expect(y).toBeGreaterThanOrEqual(layout.tray.y - 1e-9);
            expect(y).toBeLessThanOrEqual(layout.tray.y + layout.tray.h + 1e-9);
          }
        }
      }
    }
    // And the tray draws at one scale for every piece: sizes compare honestly.
    const shape = orientedShape('S1', { r: 0, f: 0 }).map(ptToFloat);
    const px = trayPixels(layout, 'S1', { r: 0, f: 0 });
    expect(px[1]![0] - px[0]![0]).toBeCloseTo((shape[1]![0] - shape[0]![0]) * layout.trayPpu, 9);
  });

  it('grows the board with the room on a large screen, square and capped', () => {
    const small = playLayout(360, 391, FIGURES[0]!.outline);
    const large = playLayout(1024, 700, FIGURES[0]!.outline);
    expect(large.board.w).toBeGreaterThan(small.board.w);
    expect(large.board.w).toBe(large.board.h);
    expect(large.board.w).toBeLessThanOrEqual(560);
  });
});

describe('a short play area — a phone held sideways (§13「横持ちと低い画面」)', () => {
  // A 640×360 phone in landscape — the web build only: the native apps are
  // locked to portrait. The play area is 640 wide and what the bars (and the
  // ad reserve, where there is one) leave of the 360.
  const NO_ADS_SIDEWAYS = 360 - TOP_BAR - ACTION_BAR;
  const WEB_SIDEWAYS = NO_ADS_SIDEWAYS - WEB_AD_RESERVE;
  const bottom = (height: number) => {
    const layout = playLayout(640, height, FIGURES[0]!.outline);
    return {
      trayTop: layout.tray.y,
      trayBottom: layout.tray.y + layout.tray.h,
      board: layout.board.w,
    };
  };

  it('keeps the whole tray in view down to 240 px, and clips it below (a known limit)', () => {
    expect(bottom(240).trayBottom).toBeLessThanOrEqual(240 + 1e-9);
    expect(bottom(239).trayBottom).toBeGreaterThan(239);
    // The board stops at its floor rather than shrinking further.
    expect(bottom(239).board).toBe(160);
    // Sideways without ads: part of the tray is cut off.
    expect(NO_ADS_SIDEWAYS).toBe(227);
    expect(bottom(NO_ADS_SIDEWAYS).trayBottom).toBeGreaterThan(NO_ADS_SIDEWAYS);
    expect(bottom(NO_ADS_SIDEWAYS).trayTop).toBeLessThan(NO_ADS_SIDEWAYS);
    // Web sideways with ads: the tray starts below the play area — not playable.
    expect(WEB_SIDEWAYS).toBe(111);
    expect(bottom(WEB_SIDEWAYS).trayTop).toBeGreaterThan(WEB_SIDEWAYS);
    expect(bottom(168).trayTop).toBeGreaterThanOrEqual(168);
  });
});

describe('the pointer’s snap reach (§5「範囲と仕事量」)', () => {
  it('is SNAP_PX on the board, and never past the keyboard’s one unit', () => {
    expect(pointerTolerance(28, KEYBOARD_TOLERANCE)).toBeCloseTo(SNAP_PX / 28, 12);
    expect(pointerTolerance(10, KEYBOARD_TOLERANCE)).toBe(KEYBOARD_TOLERANCE);
    expect(pointerTolerance(0, KEYBOARD_TOLERANCE)).toBe(KEYBOARD_TOLERANCE);
    // On the 360×640 web phone, every figure's reach is inside what Phase 2 measured.
    for (const figure of FIGURES) {
      const { ppu } = playLayout(WEB_PHONE.width, WEB_PHONE.height, figure.outline);
      expect(pointerTolerance(ppu, KEYBOARD_TOLERANCE)).toBeLessThanOrEqual(KEYBOARD_TOLERANCE);
    }
  });
});
