/**
 * The table's own half of a drag (docs/SOLITAIRE_RULES.md §3, issue #116): the
 * geometry that turns a pointer into a spot, the travel that turns a press
 * into a drag, and how little the screen is told. What the screen does with a
 * drop is SolitaireRoot.test.tsx's business.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { dealBoard } from '../../game';
import {
  DRAG_THRESHOLD_PX,
  dropTargetAt,
  SolitaireTable,
  type DropZones,
  type SolitaireTableProps,
} from './SolitaireTable';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('dropTargetAt', () => {
  /** Seven 45px columns on a 50px pitch, a 63px top row, the tableau from y=75. */
  const zones: DropZones = {
    left: -22.5,
    right: 345 + 22.5,
    top: -31.5,
    rowBottom: 69,
    columnEdges: [47.5, 97.5, 147.5, 197.5, 247.5, 297.5],
    foundations: [0, 1, 2, 3].map((suit) => ({
      suit: suit as 0 | 1 | 2 | 3,
      left: (3 + suit) * 50 - 2.5,
      right: (3 + suit) * 50 + 47.5,
    })),
  };

  it('names the column under the pointer, anywhere down the felt', () => {
    expect(dropTargetAt(zones, 22, 100)).toEqual({ type: 'tableau', pile: 0 });
    expect(dropTargetAt(zones, 322, 100)).toEqual({ type: 'tableau', pile: 6 });
    // Far below the last card of a short pile is still that column.
    expect(dropTargetAt(zones, 172, 900)).toEqual({ type: 'tableau', pile: 3 });
  });

  it('has no dead pixel between two columns: the gap splits down the middle', () => {
    expect(dropTargetAt(zones, 47, 100)).toEqual({ type: 'tableau', pile: 0 });
    expect(dropTargetAt(zones, 48, 100)).toEqual({ type: 'tableau', pile: 1 });
  });

  it('names a foundation in the top row, and nothing else there', () => {
    expect(dropTargetAt(zones, 172, 30)).toEqual({ type: 'foundation', suit: 0 });
    expect(dropTargetAt(zones, 322, 30)).toEqual({ type: 'foundation', suit: 3 });
    // The stock, the waste, and the gap take nothing.
    expect(dropTargetAt(zones, 22, 30)).toBeNull();
    expect(dropTargetAt(zones, 72, 30)).toBeNull();
    expect(dropTargetAt(zones, 122, 30)).toBeNull();
  });

  it('is nothing off the table', () => {
    expect(dropTargetAt(zones, -40, 100)).toBeNull();
    expect(dropTargetAt(zones, 400, 100)).toBeNull();
    expect(dropTargetAt(zones, 100, -50)).toBeNull();
  });
});

describe('SolitaireTable drag reporting', () => {
  const COL = 50;
  const CARD_W = 45;
  const rect = (left: number, top: number, width: number, height: number): DOMRect =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;

  /**
   * `cards` gives face-up cards a rectangle of their own — the one on pile 1,
   * for the golden deal's J♣ — and the felt (the table's parent) the bounds the
   * carry is clamped to. Without them, the table falls back to the fingertip
   * and clamps nothing, which is what the other tests here rely on.
   */
  function giveTableALayout(cards = false): void {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const el = this as HTMLElement;
      if (el.dataset.topRow !== undefined) return rect(0, 0, COL * 7 - (COL - CARD_W), 63);
      if (el.dataset.pile !== undefined)
        return rect(Number(el.dataset.pile) * COL, 75, CARD_W, 200);
      if (el.dataset.foundation !== undefined) {
        return rect((3 + Number(el.dataset.foundation)) * COL, 0, CARD_W, 63);
      }
      if (cards && el.dataset.card !== undefined) return rect(0, 75, CARD_W, 63);
      if (cards && el.classList.contains('sol-body')) return rect(-10, -10, 400, 400);
      return rect(0, 0, 0, 0);
    });
  }

  function renderTable(overrides: Partial<SolitaireTableProps> = {}) {
    const props: SolitaireTableProps = {
      board: dealBoard('sol-free-golden'),
      moveTick: 0,
      selection: null,
      hint: null,
      destinations: [],
      foundationTarget: null,
      drag: null,
      drop: null,
      dropLegal: false,
      onStockTap: vi.fn(),
      onWasteTap: vi.fn(),
      onFoundationTap: vi.fn(),
      onTableauTap: vi.fn(),
      onDragStart: vi.fn(),
      onDragTarget: vi.fn(),
      onDragEnd: vi.fn(() => false),
      ...overrides,
    };
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <div className="sol-body">
          <SolitaireTable {...props} />
        </div>
      </SettingsProvider>,
    );
    return props;
  }

  const table = () => screen.getByRole('group', { name: 'Solitaire table' });
  const jack = () => within(table()).getByRole('button', { name: 'J of clubs' });
  const PRESS = { clientX: 22, clientY: 160 };

  it('tells the screen about the spot under the finger only when it changes', () => {
    const props = renderTable();
    giveTableALayout();

    const el = jack();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    // Six moves inside column 2 are one piece of news; the seventh, into
    // column 3, is the next. A finger moving inside one column must not
    // re-render the table per event (issue #116).
    for (let i = 0; i < 6; i++) {
      fireEvent.pointerMove(el, {
        pointerId: 1,
        buttons: 1,
        clientX: 60 + i * 4,
        clientY: 200 + i,
      });
    }
    expect(props.onDragStart).toHaveBeenCalledTimes(1);
    expect(props.onDragStart).toHaveBeenCalledWith({ type: 'tableau', pile: 0, index: 0 });
    expect(props.onDragTarget).toHaveBeenCalledTimes(1);
    expect(props.onDragTarget).toHaveBeenLastCalledWith({ type: 'tableau', pile: 1 });

    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 122, clientY: 200 });
    expect(props.onDragTarget).toHaveBeenCalledTimes(2);
    expect(props.onDragTarget).toHaveBeenLastCalledWith({ type: 'tableau', pile: 2 });

    // Over the top row's stock: a spot that is no spot, reported once.
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 22, clientY: 30 });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 24, clientY: 32 });
    expect(props.onDragTarget).toHaveBeenCalledTimes(3);
    expect(props.onDragTarget).toHaveBeenLastCalledWith(null);

    fireEvent.pointerUp(el, { pointerId: 1, button: 0, clientX: 24, clientY: 32 });
    expect(props.onDragEnd).toHaveBeenCalledTimes(1);
    expect(props.onDragEnd).toHaveBeenCalledWith({ type: 'tableau', pile: 0, index: 0 }, null);
  });

  it('carries the pressed cards by an inline transform, and puts them back', () => {
    renderTable();
    giveTableALayout();

    const el = jack();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 72, clientY: 200 });
    expect(el.style.transform).toBe('translate(50px, 40px)');

    // Let go where nothing happens (the screen says so): back where it lay.
    fireEvent.pointerUp(el, { pointerId: 1, button: 0, clientX: 72, clientY: 200 });
    expect(el.style.transform).toBe('');
    expect(el.style.zIndex).toBe('');
  });

  it('does not start a drag before the travel threshold', () => {
    const props = renderTable();
    giveTableALayout();

    const el = jack();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    const short = DRAG_THRESHOLD_PX - 1;
    fireEvent.pointerMove(el, {
      pointerId: 1,
      buttons: 1,
      clientX: PRESS.clientX + short,
      clientY: PRESS.clientY,
    });
    expect(props.onDragStart).not.toHaveBeenCalled();
    expect(el.style.transform).toBe('');

    fireEvent.pointerUp(el, {
      pointerId: 1,
      button: 0,
      clientX: PRESS.clientX + short,
      clientY: 160,
    });
    expect(props.onDragEnd).not.toHaveBeenCalled();
    // The click a short press ends in is the tap path's, untouched.
    fireEvent.click(el, { detail: 1 });
    expect(props.onTableauTap).toHaveBeenCalledWith(0, 0);
  });

  it('ignores a second finger, a right button, and a pen barrel', () => {
    const props = renderTable();
    giveTableALayout();

    const el = jack();
    fireEvent.pointerDown(el, { pointerId: 1, button: 2, buttons: 2, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 2, clientX: 72, clientY: 200 });
    expect(props.onDragStart).not.toHaveBeenCalled();

    // A pen's barrel held as the tip comes down: the left button with the
    // right one already inside `buttons`.
    fireEvent.pointerDown(el, { pointerId: 2, button: 0, buttons: 3, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 2, buttons: 3, clientX: 72, clientY: 200 });
    expect(props.onDragStart).not.toHaveBeenCalled();

    // One drag in flight; a second finger picks nothing else up.
    fireEvent.pointerDown(el, { pointerId: 3, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 3, buttons: 1, clientX: 72, clientY: 200 });
    expect(props.onDragStart).toHaveBeenCalledTimes(1);
    const other = within(table()).getByRole('button', { name: 'Q of diamonds' });
    fireEvent.pointerDown(other, { pointerId: 4, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(other, { pointerId: 4, buttons: 1, clientX: 172, clientY: 200 });
    expect(props.onDragStart).toHaveBeenCalledTimes(1);
    expect(other.style.transform).toBe('');
  });

  it('ends a drag whose release never arrived when the same pointer presses again', () => {
    const props = renderTable();
    giveTableALayout();

    // Capture refused, button let go off the table: the release is missed.
    // The mouse pressing again is what says the last drag is over.
    const el = jack();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 72, clientY: 200 });
    expect(el.style.transform).toBe('translate(50px, 40px)');

    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    expect(props.onDragEnd).toHaveBeenCalledWith({ type: 'tableau', pile: 0, index: 0 }, null);
    expect(el.style.transform).toBe('');
    // And the new press is a live one.
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 122, clientY: 200 });
    expect(props.onDragStart).toHaveBeenCalledTimes(2);
  });

  it('aims with the card, not the fingertip: the grab offset moves the spot', () => {
    const props = renderTable();
    giveTableALayout(true);

    // The J♣ occupies (0..45, 75..138); pressed 2px above its bottom edge, its
    // middle is 30.5px above the finger. Carried until the finger is at
    // y=95 — in the tableau band — the card's middle is at 64.5, in the top
    // row over the spades foundation: that is where the player sees it.
    const el = jack();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, clientX: 22, clientY: 136 });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 172, clientY: 95 });
    expect(props.onDragTarget).toHaveBeenLastCalledWith({ type: 'foundation', suit: 0 });

    // A little lower, and the middle crosses into the column below.
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 172, clientY: 110 });
    expect(props.onDragTarget).toHaveBeenLastCalledWith({ type: 'tableau', pile: 3 });
  });

  it('keeps the carried run on the felt', () => {
    renderTable();
    giveTableALayout(true);

    // The felt spans (-10..390, -10..390) and the card (0..45, 75..138): it
    // may travel 10px left, 345px right, 85px up, 252px down, and no further
    // — a card carried off the felt would grow it a scrollbar.
    const el = jack();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 22 - 500, clientY: 160 - 500 });
    expect(el.style.transform).toBe('translate(-10px, -85px)');
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 22 + 900, clientY: 160 + 900 });
    expect(el.style.transform).toBe('translate(345px, 252px)');
  });

  it('lets the click through when the cards were let go back on their own column', () => {
    const props = renderTable();
    giveTableALayout();

    // Browsers draw their own line between a tap and a drag, and a press that
    // travelled past this table's line but not the browser's still ends in a
    // click. Let go over its own column, that click is the tap it always was.
    const el = jack();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 22, clientY: 172 });
    expect(props.onDragStart).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(el, { pointerId: 1, button: 0, clientX: 22, clientY: 172 });
    expect(props.onDragEnd).toHaveBeenCalledWith(
      { type: 'tableau', pile: 0, index: 0 },
      { type: 'tableau', pile: 0 },
    );
    fireEvent.click(el, { detail: 1 });
    expect(props.onTableauTap).toHaveBeenCalledWith(0, 0);
  });

  it('swallows the click after a drop somewhere else, wherever it lands', () => {
    const props = renderTable();
    giveTableALayout();

    const el = jack();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 72, clientY: 200 });
    fireEvent.pointerUp(el, { pointerId: 1, button: 0, clientX: 72, clientY: 200 });
    // Safari does not retarget the click to the captured card: it may arrive
    // on whatever is under the pointer. The mark is the table's, not one
    // button's.
    fireEvent.click(within(table()).getByRole('button', { name: 'Q of diamonds' }), { detail: 1 });
    expect(props.onTableauTap).not.toHaveBeenCalled();
    // Spent: the next real tap is heard.
    fireEvent.click(within(table()).getByRole('button', { name: 'Q of diamonds' }), { detail: 1 });
    expect(props.onTableauTap).toHaveBeenCalledWith(1, 0);
  });

  it('ends a drag whose release never arrived when the same pointer presses anywhere', () => {
    const props = renderTable();
    giveTableALayout();

    // Capture refused, button let go off the table: the release is missed.
    // The mouse pressing again — here on the stock — is what says the last
    // drag is over.
    const el = jack();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 72, clientY: 200 });
    expect(el.style.transform).toBe('translate(50px, 40px)');

    const stock = within(table()).getByRole('button', { name: /^Stock/ });
    fireEvent.pointerDown(stock, { pointerId: 1, button: 0, buttons: 1, clientX: 22, clientY: 30 });
    expect(props.onDragEnd).toHaveBeenCalledWith({ type: 'tableau', pile: 0, index: 0 }, null);
    expect(el.style.transform).toBe('');
    // And the stock's own click is not the one a drag left behind.
    fireEvent.click(stock, { detail: 1 });
    expect(props.onStockTap).toHaveBeenCalledTimes(1);
  });

  it('ends a drag when the mouse moves with its button already up', () => {
    const props = renderTable();
    giveTableALayout();

    const el = jack();
    fireEvent.pointerDown(el, {
      pointerId: 1,
      button: 0,
      buttons: 1,
      pointerType: 'mouse',
      ...PRESS,
    });
    fireEvent.pointerMove(el, {
      pointerId: 1,
      buttons: 1,
      pointerType: 'mouse',
      clientX: 72,
      clientY: 200,
    });
    // The release went to a context menu, another window — the table never
    // saw it. The next move says so.
    fireEvent.pointerMove(el, {
      pointerId: 1,
      buttons: 0,
      pointerType: 'mouse',
      clientX: 80,
      clientY: 210,
    });
    expect(props.onDragEnd).toHaveBeenCalledWith({ type: 'tableau', pile: 0, index: 0 }, null);
    expect(el.style.transform).toBe('');
  });

  it('ends a drag when the window loses focus', () => {
    const props = renderTable();
    giveTableALayout();

    const el = jack();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 72, clientY: 200 });
    fireEvent.blur(window);
    expect(props.onDragEnd).toHaveBeenCalledWith({ type: 'tableau', pile: 0, index: 0 }, null);
    expect(el.style.transform).toBe('');
  });

  it("lights one foundation, the held card's own", () => {
    renderTable({ foundationTarget: 3 });
    const marked = table().querySelectorAll('[data-foundation].sol-destination');
    expect(marked).toHaveLength(1);
    expect((marked[0] as HTMLElement).dataset.foundation).toBe('3');
  });
});
