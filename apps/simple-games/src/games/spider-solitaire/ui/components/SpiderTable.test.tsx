/**
 * The table's own half of a drag (docs/SPIDER_SOLITAIRE_RULES.md §3, issue
 * #119): the geometry that turns a pointer into a column, the travel that
 * turns a press into a drag, and how little the screen is told. What the
 * screen does with a drop is SpiderRoot.test.tsx's business.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { dealBoard } from '../../game';
import {
  DRAG_THRESHOLD_PX,
  dropTargetAt,
  SpiderTable,
  type DropZones,
  type SpiderTableProps,
} from './SpiderTable';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('dropTargetAt', () => {
  /** Ten 45px columns on a 50px pitch, a 63px top row, the tableau from y=75. */
  const zones: DropZones = {
    left: -22.5,
    right: 495 + 22.5,
    top: -31.5,
    rowBottom: 69,
    columnEdges: [47.5, 97.5, 147.5, 197.5, 247.5, 297.5, 347.5, 397.5, 447.5],
  };

  it('names the column under the pointer, anywhere down the felt', () => {
    expect(dropTargetAt(zones, 22, 100)).toEqual({ pile: 0 });
    expect(dropTargetAt(zones, 472, 100)).toEqual({ pile: 9 });
    // Far below the last card of a short column is still that column.
    expect(dropTargetAt(zones, 172, 900)).toEqual({ pile: 3 });
  });

  it('has no dead pixel between two columns: the gap splits down the middle', () => {
    expect(dropTargetAt(zones, 47, 100)).toEqual({ pile: 0 });
    expect(dropTargetAt(zones, 48, 100)).toEqual({ pile: 1 });
  });

  it('is nothing in the top row: the stock and the completed-run slots take nothing', () => {
    expect(dropTargetAt(zones, 22, 30)).toBeNull();
    expect(dropTargetAt(zones, 172, 30)).toBeNull();
    expect(dropTargetAt(zones, 472, 30)).toBeNull();
  });

  it('is nothing off the table', () => {
    expect(dropTargetAt(zones, -40, 100)).toBeNull();
    expect(dropTargetAt(zones, 550, 100)).toBeNull();
    expect(dropTargetAt(zones, 100, -50)).toBeNull();
  });
});

describe('SpiderTable drag reporting', () => {
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
   * `cards` gives face-up cards a rectangle of their own — the one on column
   * 2, for the golden deal's A♠ — and the felt (the table's parent) the
   * bounds the carry is clamped to. Without them, the table falls back to the
   * fingertip and clamps nothing, which is what the other tests here rely on.
   */
  function giveTableALayout(cards = false, felt: DOMRect = rect(-10, -10, 400, 400)): void {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const el = this as HTMLElement;
      if (el.dataset.topRow !== undefined) return rect(0, 0, COL * 10 - (COL - CARD_W), 63);
      if (el.dataset.pile !== undefined)
        return rect(Number(el.dataset.pile) * COL, 75, CARD_W, 200);
      if (cards && el.dataset.card !== undefined) return rect(0, 75, CARD_W, 63);
      if (cards && el.classList.contains('sp-body')) return felt;
      return rect(0, 0, 0, 0);
    });
  }

  /** What the felt holds and how far it is scrolled, which jsdom cannot say. */
  function giveFeltAScroll(scrollTop: number, scrollHeight: number): void {
    const body = document.querySelector('.sp-body')!;
    Object.defineProperty(body, 'scrollTop', { configurable: true, value: scrollTop });
    Object.defineProperty(body, 'scrollHeight', { configurable: true, value: scrollHeight });
  }

  function renderTable(overrides: Partial<SpiderTableProps> = {}) {
    const props: SpiderTableProps = {
      board: dealBoard('ss-free-golden', 1),
      moveTick: 0,
      selection: null,
      hint: null,
      destinations: [],
      drag: null,
      drop: null,
      dropLegal: false,
      onStockTap: vi.fn(),
      onColumnTap: vi.fn(),
      onDragStart: vi.fn(),
      onDragTarget: vi.fn(),
      onDragEnd: vi.fn(() => false),
      ...overrides,
    };
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <div className="sp-body">
          <SpiderTable {...props} />
        </div>
      </SettingsProvider>,
    );
    return props;
  }

  const table = () => screen.getByRole('group', { name: 'Spider Solitaire table' });
  const column = (n: number) => within(table()).getByRole('group', { name: `Column ${n}` });
  // Column 2's face-up part is the ace alone (compatibility.test.ts), the
  // same shape as Solitaire's lone J♣: a single card to press and carry.
  const ace = () => within(column(2)).getByRole('button', { name: 'A of spades' });
  const PRESS = { clientX: 72, clientY: 160 };

  it('tells the screen about the spot under the finger only when it changes', () => {
    const props = renderTable();
    giveTableALayout();

    const el = ace();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    // Six moves inside column 3 are one piece of news; the seventh, into
    // column 4, is the next. A finger moving inside one column must not
    // re-render the table per event (issue #119).
    for (let i = 0; i < 6; i++) {
      fireEvent.pointerMove(el, {
        pointerId: 1,
        buttons: 1,
        clientX: 110 + i * 4,
        clientY: 200 + i,
      });
    }
    expect(props.onDragStart).toHaveBeenCalledTimes(1);
    expect(props.onDragStart).toHaveBeenCalledWith({ pile: 1, index: 0 });
    expect(props.onDragTarget).toHaveBeenCalledTimes(1);
    expect(props.onDragTarget).toHaveBeenLastCalledWith({ pile: 2 });

    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 172, clientY: 200 });
    expect(props.onDragTarget).toHaveBeenCalledTimes(2);
    expect(props.onDragTarget).toHaveBeenLastCalledWith({ pile: 3 });

    // Over the top row: a spot that is no spot, reported once.
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 72, clientY: 30 });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 74, clientY: 32 });
    expect(props.onDragTarget).toHaveBeenCalledTimes(3);
    expect(props.onDragTarget).toHaveBeenLastCalledWith(null);

    fireEvent.pointerUp(el, { pointerId: 1, button: 0, clientX: 74, clientY: 32 });
    expect(props.onDragEnd).toHaveBeenCalledTimes(1);
    expect(props.onDragEnd).toHaveBeenCalledWith({ pile: 1, index: 0 }, null, false);
  });

  it('carries the pressed cards by an inline transform, and puts them back', () => {
    renderTable();
    giveTableALayout();

    const el = ace();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 122, clientY: 200 });
    expect(el.style.transform).toBe('translate(50px, 40px)');

    // Let go where nothing happens (the screen says so): back where it lay.
    fireEvent.pointerUp(el, { pointerId: 1, button: 0, clientX: 122, clientY: 200 });
    expect(el.style.transform).toBe('');
    expect(el.style.zIndex).toBe('');
  });

  it('does not start a drag before the travel threshold', () => {
    const props = renderTable();
    giveTableALayout();

    const el = ace();
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
    expect(props.onColumnTap).toHaveBeenCalledWith(1, 0);
  });

  it('ignores a second finger, a right button, and a pen barrel', () => {
    const props = renderTable();
    giveTableALayout();

    const el = ace();
    fireEvent.pointerDown(el, { pointerId: 1, button: 2, buttons: 2, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 2, clientX: 122, clientY: 200 });
    expect(props.onDragStart).not.toHaveBeenCalled();

    // A pen's barrel held as the tip comes down: the left button with the
    // right one already inside `buttons`.
    fireEvent.pointerDown(el, { pointerId: 2, button: 0, buttons: 3, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 2, buttons: 3, clientX: 122, clientY: 200 });
    expect(props.onDragStart).not.toHaveBeenCalled();

    // One drag in flight; a second finger picks nothing else up.
    fireEvent.pointerDown(el, { pointerId: 3, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 3, buttons: 1, clientX: 122, clientY: 200 });
    expect(props.onDragStart).toHaveBeenCalledTimes(1);
    const other = within(column(3)).getByRole('button', { name: '10 of spades' });
    fireEvent.pointerDown(other, { pointerId: 4, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(other, { pointerId: 4, buttons: 1, clientX: 222, clientY: 200 });
    expect(props.onDragStart).toHaveBeenCalledTimes(1);
    expect(other.style.transform).toBe('');
  });

  it('ends a drag whose release never arrived when the same pointer presses again', () => {
    const props = renderTable();
    giveTableALayout();

    // Capture refused, button let go off the table: the release is missed.
    // The mouse pressing again is what says the last drag is over.
    const el = ace();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 122, clientY: 200 });
    expect(el.style.transform).toBe('translate(50px, 40px)');

    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    expect(props.onDragEnd).toHaveBeenCalledWith({ pile: 1, index: 0 }, null, false);
    expect(el.style.transform).toBe('');
    // And the new press is a live one.
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 172, clientY: 200 });
    expect(props.onDragStart).toHaveBeenCalledTimes(2);
  });

  it('ends a drag whose release never arrived when the same pointer presses anywhere', () => {
    const props = renderTable();
    giveTableALayout();

    // Capture refused, button let go off the table: the release is missed.
    // The mouse pressing again — here on the stock — is what says the last
    // drag is over.
    const el = ace();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 122, clientY: 200 });
    expect(el.style.transform).toBe('translate(50px, 40px)');

    const stock = within(table()).getByRole('button', { name: /^Stock/ });
    fireEvent.pointerDown(stock, { pointerId: 1, button: 0, buttons: 1, clientX: 22, clientY: 30 });
    expect(props.onDragEnd).toHaveBeenCalledWith({ pile: 1, index: 0 }, null, false);
    expect(el.style.transform).toBe('');
    // And the stock's own click is not the one a drag left behind.
    fireEvent.click(stock, { detail: 1 });
    expect(props.onStockTap).toHaveBeenCalledTimes(1);
  });

  it('aims with the card, not the fingertip: the grab offset moves the spot', () => {
    const props = renderTable();
    giveTableALayout(true);

    // The A♠ occupies (0..45, 75..138); pressed 2px above its bottom edge, its
    // middle is 29.5px above the finger. Crossing the threshold already aimed
    // at y=110, the card's middle is at 80.5 — in the tableau, over column 4.
    const el = ace();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, clientX: 22, clientY: 136 });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 172, clientY: 110 });
    expect(props.onDragTarget).toHaveBeenLastCalledWith({ pile: 3 });

    // A little higher, and the middle crosses into the top row — there is no
    // target there at all in Spider, unlike Klondike's foundations (§3).
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 172, clientY: 95 });
    expect(props.onDragTarget).toHaveBeenLastCalledWith(null);
  });

  it('keeps the carried run on the felt', () => {
    renderTable();
    giveTableALayout(true);

    // The felt spans (-10..390, -10..390) and the card (0..45, 75..138): it
    // may travel 10px left, 345px right, 85px up, 252px down, and no further
    // — a card carried off the felt would grow it a scrollbar.
    const el = ace();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 72 - 500, clientY: 160 - 500 });
    expect(el.style.transform).toBe('translate(-10px, -85px)');
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 72 + 900, clientY: 160 + 900 });
    expect(el.style.transform).toBe('translate(345px, 252px)');
  });

  it('carries a run whose tail is below the fold without jerking it', () => {
    renderTable();
    // A felt shorter than the column it holds — a phone in landscape (§3).
    // The run at rest already reaches below the visible bottom, and what it
    // may not leave is the felt's content, not the part of it in view:
    // bounding the carry by the visible box would snap the run upward on its
    // first move, under a finger that went sideways.
    giveTableALayout(true, rect(-10, -10, 400, 120));
    giveFeltAScroll(0, 400);

    const el = ace();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 80, clientY: 160 });
    expect(el.style.transform).toBe('translate(8px, 0px)');

    // And it can still be carried up to the top row, as far as the top of
    // the content — a run taller than the felt must not be pinned where it lies.
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 72, clientY: -500 });
    expect(el.style.transform).toBe('translate(0px, -85px)');
  });

  it('hands a press let go all but where it began back to the tap path', () => {
    const props = renderTable();
    giveTableALayout();

    // Browsers draw their own line between a tap and a drag, and a press that
    // travelled past this table's line but not the browser's still ends in a
    // click. Twelve pixels is that band: the screen is told a tap follows, and
    // the click goes through as the tap it always was.
    const el = ace();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 72, clientY: 172 });
    expect(props.onDragStart).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(el, { pointerId: 1, button: 0, clientX: 72, clientY: 172 });
    expect(props.onDragEnd).toHaveBeenCalledWith({ pile: 1, index: 0 }, { pile: 1 }, true);
    fireEvent.click(el, { detail: 1 });
    expect(props.onColumnTap).toHaveBeenCalledWith(1, 0);
  });

  it('swallows the click of a real drag let go back on its own column', () => {
    const props = renderTable();
    giveTableALayout();

    // Carried right down its own column and dropped: a finished drag, however
    // little the board made of it. Nothing is picked up by the click it
    // leaves — a failed drag is over, not the first tap of something (§3).
    const el = ace();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 72, clientY: 300 });
    fireEvent.pointerUp(el, { pointerId: 1, button: 0, clientX: 72, clientY: 300 });
    expect(props.onDragEnd).toHaveBeenCalledWith({ pile: 1, index: 0 }, { pile: 1 }, false);
    fireEvent.click(el, { detail: 1 });
    expect(props.onColumnTap).not.toHaveBeenCalled();
  });

  it('swallows the click after a drop somewhere else, wherever it lands', () => {
    const props = renderTable();
    giveTableALayout();

    const el = ace();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 122, clientY: 200 });
    fireEvent.pointerUp(el, { pointerId: 1, button: 0, clientX: 122, clientY: 200 });
    // Safari does not retarget the click to the captured card: it may arrive
    // on whatever is under the pointer. The mark is the table's, not one
    // button's.
    const other = within(column(3)).getByRole('button', { name: '10 of spades' });
    fireEvent.click(other, { detail: 1 });
    expect(props.onColumnTap).not.toHaveBeenCalled();
    // Spent: the next real tap is heard.
    fireEvent.click(other, { detail: 1 });
    expect(props.onColumnTap).toHaveBeenCalledWith(2, 0);
  });

  it('ends a drag when the mouse moves with its button already up', () => {
    const props = renderTable();
    giveTableALayout();

    const el = ace();
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
      clientX: 122,
      clientY: 200,
    });
    // The release went to a context menu, another window — the table never
    // saw it. The next move says so.
    fireEvent.pointerMove(el, {
      pointerId: 1,
      buttons: 0,
      pointerType: 'mouse',
      clientX: 130,
      clientY: 210,
    });
    expect(props.onDragEnd).toHaveBeenCalledWith({ pile: 1, index: 0 }, null, false);
    expect(el.style.transform).toBe('');
  });

  it('ends a drag when the window loses focus', () => {
    const props = renderTable();
    giveTableALayout();

    const el = ace();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 122, clientY: 200 });
    fireEvent.blur(window);
    expect(props.onDragEnd).toHaveBeenCalledWith({ pile: 1, index: 0 }, null, false);
    expect(el.style.transform).toBe('');
  });

  it('does not take the click after a drag the window blur ended for a tap', () => {
    const props = renderTable();
    giveTableALayout();

    const el = ace();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 122, clientY: 200 });
    fireEvent.blur(window);
    // The window comes back and the button is let go over the table: the
    // release finds no drag, but the click still arrives, and it belongs to
    // the drag that was abandoned.
    fireEvent.pointerUp(el, { pointerId: 1, button: 0, clientX: 122, clientY: 200 });
    fireEvent.click(el, { detail: 1 });
    expect(props.onColumnTap).not.toHaveBeenCalled();

    // Spent by the next press, which is a live one.
    fireEvent.pointerDown(el, { pointerId: 2, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerUp(el, { pointerId: 2, button: 0, ...PRESS });
    fireEvent.click(el, { detail: 1 });
    expect(props.onColumnTap).toHaveBeenCalledWith(1, 0);
  });

  it('ends the drag when the felt scrolls under it', () => {
    const props = renderTable();
    giveTableALayout();
    giveFeltAScroll(0, 400);

    const el = ace();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 122, clientY: 200 });
    // A wheel while the button is held: everything this drag measured is in
    // the viewport's coordinates, and the table has just moved inside it.
    // Better over than aimed at a column it is no longer above.
    giveFeltAScroll(40, 400);
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 124, clientY: 202 });

    expect(props.onDragEnd).toHaveBeenCalledWith({ pile: 1, index: 0 }, null, false);
    expect(el.style.transform).toBe('');
  });

  it('tells the screen when a board change takes a drag away', () => {
    const props: SpiderTableProps = {
      board: dealBoard('ss-free-golden', 1),
      moveTick: 0,
      selection: null,
      hint: null,
      destinations: [],
      drag: null,
      drop: null,
      dropLegal: false,
      onStockTap: vi.fn(),
      onColumnTap: vi.fn(),
      onDragStart: vi.fn(),
      onDragTarget: vi.fn(),
      onDragEnd: vi.fn(() => false),
    };
    const view = (extra: Partial<SpiderTableProps> = {}) => (
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <div className="sp-body">
          <SpiderTable {...props} {...extra} />
        </div>
      </SettingsProvider>
    );
    const { rerender } = render(view());
    giveTableALayout();

    const el = ace();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...PRESS });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, clientX: 122, clientY: 200 });
    expect(el.style.transform).toBe('translate(50px, 40px)');

    // Undo from the keyboard while a card is in hand: the cards the drag was
    // carrying may not be where it thinks any more. It ends, and the screen
    // is told so its marks go down with the table's.
    const targetCalls = (props.onDragTarget as ReturnType<typeof vi.fn>).mock.calls.length;
    rerender(view({ board: dealBoard('ss-free-other', 1), moveTick: 1 }));
    expect(props.onDragEnd).toHaveBeenCalledWith({ pile: 1, index: 0 }, null, false);

    // And it really is over: the finger moving on has nothing to carry, and
    // the release it eventually gets cannot end the drag a second time.
    fireEvent.pointerMove(table(), { pointerId: 1, buttons: 1, clientX: 250, clientY: 300 });
    fireEvent.pointerUp(table(), { pointerId: 1, button: 0, clientX: 250, clientY: 300 });
    expect(props.onDragTarget).toHaveBeenCalledTimes(targetCalls);
    expect(props.onDragEnd).toHaveBeenCalledTimes(1);
  });
});
