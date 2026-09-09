/**
 * What a board must do when the platform takes the finger away, and what it
 * must not do with the click a gesture leaves behind (issue #169).
 *
 * `pointercancel` is the one pointer event nobody writes a gesture for. It
 * arrives when the OS decides the press was really something else — the
 * notification shade coming down, an incoming call, a palm on the glass, a
 * pen leaving range, a scroll the browser claimed for itself — and it is the
 * end of that pointer: no `pointerup` follows it, and no `click` either. A
 * board that only listens for the release keeps whatever the press armed:
 * a card stays lifted, a timer still fires, a guard stays raised and eats the
 * next tap. Three bugs of exactly that shape have already been fixed here
 * (Bubble Pop firing on a cancel, issue #144; the collection's tile-sheet
 * click guard, PR #141; Nonogram's `swallowMenuRef`, issue #174), which is
 * why the wiring is now gated rather than remembered.
 *
 * The other half is the click a press leaves behind. A drag that ends over a
 * control still raises a `click` on it, so a board that both drags and taps
 * plays the drag and then the tap unless it marks the click as spent.
 *
 * WHAT THIS GATE PROVES, AND WHAT IT LEAVES TO THE GAMES
 *
 * Not the behaviour. What a cancel *means* is different in every game — the
 * cards go back (Solitaire), the shot is not taken (Bubble Pop), the piece
 * returns to the tray (Block Puzzle) — and a shared pointer layer is exactly
 * what 「シェルの枠とゲームの中身」(docs/ARCHITECTURE.md) says not to build.
 * So this gate asks for two things only: the *wiring* (a release is never
 * heard without a cancel beside it) and the *existence of the game's own
 * test* that drives the event. The proof stays in each game's tests, where
 * the meaning is. `shortcutResumeWiring.test.ts` and
 * `modalIsolationWiring.test.ts` are the same shape.
 *
 * Static, and read from the filesystem rather than a list kept here, because
 * that is what makes it a gate on the next game rather than on the thirty
 * that exist: a title added tomorrow whose board takes `onPointerDown` meets
 * this the moment its folder appears.
 *
 * THE EXCEPTIONS ARE WRITTEN DOWN, NOT DERIVED
 *
 * A press that arms nothing has nothing for a cancel to release, and three
 * boards are that kind (`PRESSES_THAT_HOLD_NOTHING`). The list is written out
 * with a reason each — the shape `backup/keys.ts` uses for the shell records a
 * backup leaves behind (`SHELL_KEYS_LEFT_BEHIND`) — rather than computed,
 * because the computation would be a guess about what a press left behind, and
 * a wrong guess excuses a game silently. What IS checked is that each excuse is still true: an excused
 * board that starts tracking the finger (`onPointerMove`) or taking the
 * pointer (`setPointerCapture`) fails here until someone rewrites the reason
 * or wires the cancel. Not being on the list is what the default is.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GAMES } from '../app/registry';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GAMES_DIR = join(SRC, 'games');

/**
 * Boards whose press holds nothing, and why a `pointercancel` is therefore
 * not an event they have to hear. Each of these is checked below against the
 * only part of the reason a file can be read for: that the press neither
 * tracks the finger nor takes the pointer.
 */
const PRESSES_THAT_HOLD_NOTHING: Readonly<Record<string, string>> = {
  '2048': [
    'The press records a starting point and nothing else; the swipe is read',
    'off the release (MergeBoard.tsx, GAME_2048_RULES.md §3). A cancel is the',
    'promise that no release is coming, so the move is simply never made, and',
    'the point it left behind is overwritten by the next press.',
  ].join(' '),
  'bunny-hop': [
    'The jump happens on the press itself — a runner is judged in tenths of a',
    'second (BUNNY_HOP_RULES.md §3) — so by the time a cancel could arrive',
    'there is nothing in flight to take back.',
  ].join(' '),
  'sliding-puzzle': [
    'Like 2048: the press records a starting point, the swipe is decided on',
    'the release (SLIDING_PUZZLE_RULES.md §3), and the flag that spends the',
    'click a swipe leaves behind is cleared by the next press rather than by',
    'the end of this one.',
  ].join(' '),
};

/** Every `.tsx` under a game's `ui/`, tests told apart from the rest. */
function uiFiles(game: string, kind: 'source' | 'test'): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (!/\.tsx$/.test(entry.name)) continue;
      else if (/\.test\.tsx$/.test(entry.name) === (kind === 'test')) out.push(path);
    }
  };
  walk(join(GAMES_DIR, game, 'ui'));
  return out.sort();
}

const relative = (path: string): string => path.slice(SRC.length + 1);

/** The index in `text` matching the bracket at `openIndex`, by depth. */
function matchingClose(text: string, openIndex: number): number {
  const open = text[openIndex]!;
  const close = open === '(' ? ')' : open === '{' ? '}' : ']';
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

interface Tag {
  file: string;
  line: number;
  name: string;
  /** `onPointerDown`, `onClick`, … → the expression the prop is given. */
  props: Map<string, string>;
  selfClosing: boolean;
  /** Index of the `<`, and of the character after the opening tag's `>`. */
  start: number;
  openEnd: number;
}

/**
 * The opening tags in one file.
 *
 * A parser is more than this needs: JSX here is prettier-formatted, so a `<`
 * that begins an element is always preceded by whitespace or one of the few
 * punctuation marks an element can follow, while the `<` of `PointerEvent<…>`
 * or `i < n` never is. Attribute values are read by matching brackets, so an
 * arrow function holding a `>` inside a prop cannot end the tag early.
 */
function openingTags(file: string, text: string): Tag[] {
  const tags: Tag[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '<') continue;
    if (i > 0 && !' \t\n({},=>'.includes(text[i - 1]!)) continue;
    const name = /^<([A-Za-z][\w.]*)/.exec(text.slice(i, i + 64));
    if (!name) continue;

    let depth = 0;
    let quote = '';
    let end = -1;
    for (let j = i + name[0].length; j < text.length; j++) {
      const ch = text[j]!;
      if (quote) {
        if (ch === quote) quote = '';
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') quote = ch;
      else if ('{(['.includes(ch)) depth++;
      else if ('})]'.includes(ch)) depth--;
      else if (ch === '>' && depth === 0) {
        end = j;
        break;
      }
    }
    if (end < 0) continue;

    const props = new Map<string, string>();
    const inner = text.slice(i, end + 1);
    const attr = /\b(on[A-Z][A-Za-z]*)=/g;
    for (let match = attr.exec(inner); match; match = attr.exec(inner)) {
      const at = match.index + match[0].length;
      if (inner[at] === '{') {
        const close = matchingClose(inner, at);
        if (close > 0) props.set(match[1]!, inner.slice(at + 1, close).trim());
      } else if (inner[at] === '"' || inner[at] === "'") {
        const close = inner.indexOf(inner[at]!, at + 1);
        if (close > 0) props.set(match[1]!, inner.slice(at + 1, close).trim());
      }
    }

    tags.push({
      file,
      line: text.slice(0, i).split('\n').length,
      name: name[1]!,
      props,
      selfClosing: text[end - 1] === '/',
      start: i,
      openEnd: end + 1,
    });
    i = end;
  }
  return tags;
}

/**
 * Where a container tag's children end, by depth over its own name. Scanned
 * with `startsWith` rather than a `RegExp` built from the tag's name: a
 * pattern assembled out of file text has to be escaped, and an escape written
 * by hand here would be one more thing to get right for no gain.
 */
function subtreeEnd(text: string, tag: Tag, selfClosingStarts: ReadonlySet<number>): number {
  const opens = `<${tag.name}`;
  const closes = `</${tag.name}`;
  let depth = 1;
  for (let i = tag.openEnd; i < text.length; i++) {
    if (text[i] !== '<') continue;
    // The name has to end where the needle does: `<div` must not match
    // `<divider`, and `</Card` must not match `</CardBack>`.
    if (text.startsWith(closes, i) && ENDS_A_TAG_NAME.test(text[i + closes.length] ?? '')) {
      depth--;
      if (depth === 0) return i;
    } else if (
      text.startsWith(opens, i) &&
      ENDS_A_TAG_NAME.test(text[i + opens.length] ?? '') &&
      !selfClosingStarts.has(i)
    ) {
      depth++;
    }
  }
  return text.length;
}

/** What may follow a tag name: whitespace, or the end of the tag itself. */
const ENDS_A_TAG_NAME = /[\s/>]/;

/**
 * Where the file declares `name`, or -1. `indexOf` rather than a `RegExp` put
 * together from the name, for the reason `subtreeEnd` gives.
 */
function declarationOf(text: string, name: string): number {
  let earliest = -1;
  for (const keyword of ['const ', 'let ', 'function ']) {
    const needle = `${keyword}${name}`;
    for (let at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + 1)) {
      // `const drag` must not answer for `const dragRef`.
      if (/[\w$]/.test(text[at + needle.length] ?? '')) continue;
      if (earliest < 0 || at < earliest) earliest = at;
      break;
    }
  }
  return earliest;
}

/**
 * The body of the function a handler prop names: an inline arrow is its own
 * body, and a bare identifier is looked up where the file declares it. Null
 * when neither shape matches, which the caller reports rather than excuses.
 */
function handlerBody(text: string, expression: string): string | null {
  if (!/^[A-Za-z_$][\w$]*$/.test(expression)) {
    return expression.includes('=>') ? expression : null;
  }
  const declaration = declarationOf(text, expression);
  if (declaration < 0) return null;
  const arrow = text.indexOf('=>', declaration);
  if (arrow < 0) return null;
  const brace = text.indexOf('{', arrow);
  if (brace < 0) return null;
  const close = matchingClose(text, brace);
  return close < 0 ? null : text.slice(brace, close + 1);
}

/** The refs a handler talks to — the gesture it is about, near enough. */
function refsIn(body: string): Set<string> {
  return new Set((body.match(/\b\w+Ref\b/g) ?? []).map((name) => name));
}

interface Board {
  game: string;
  /** Elements that hear a press, a release, or a cancel. */
  tags: Tag[];
  /** Source text of every `ui/` file this game's tags came from. */
  sources: Map<string, string>;
}

const POINTER_PROPS = ['onPointerDown', 'onPointerMove', 'onPointerUp', 'onPointerCancel'];

const ids = GAMES.map((game) => game.id).sort();

const boards: Board[] = [];
for (const game of ids) {
  const tags: Tag[] = [];
  const sources = new Map<string, string>();
  for (const file of uiFiles(game, 'source')) {
    const text = readFileSync(file, 'utf8');
    const all = openingTags(file, text);
    const pointing = all.filter((tag) => POINTER_PROPS.some((prop) => tag.props.has(prop)));
    if (pointing.length === 0) continue;
    sources.set(file, text);
    const selfClosingStarts = new Set(all.filter((t) => t.selfClosing).map((t) => t.start));
    // A press can leave its click on the element itself or on anything it
    // wraps, so the subtree is read once here and carried on the tag.
    for (const tag of pointing) {
      const reach = tag.selfClosing
        ? ''
        : text.slice(tag.openEnd, subtreeEnd(text, tag, selfClosingStarts));
      if (/\bonClick=/.test(reach)) tag.props.set('descendantOnClick', 'yes');
      tags.push(tag);
    }
  }
  if (tags.length > 0) boards.push({ game, tags, sources });
}

const hearsAPress = (board: Board): boolean =>
  board.tags.some((tag) => tag.props.has('onPointerDown'));

const withPress = boards.filter(hearsAPress);
const excused = withPress.filter((board) => board.game in PRESSES_THAT_HOLD_NOTHING);
const held = withPress.filter((board) => !(board.game in PRESSES_THAT_HOLD_NOTHING));

/** A press whose click a control would also hear: itself, or something it wraps. */
const clickAdjacent = withPress.filter((board) =>
  board.tags.some(
    (tag) =>
      tag.props.has('onPointerDown') &&
      (tag.props.has('onClick') || tag.props.has('descendantOnClick')),
  ),
);

const testText = (game: string): string =>
  uiFiles(game, 'test')
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');

/**
 * Whether one `it(...)` somewhere in the game's own tests presses (or ends) a
 * pointer on an element and then clicks that same element — the sequence the
 * platform produces, and the only one that can prove the second half was not
 * played twice. Same element, because a click somewhere else in the same test
 * is a different act, not the one the press left behind.
 */
function coversTrailingClick(game: string): boolean {
  const opensCase = /^\s*(?:it|test)(?:\.\w+)?\(/;
  const gesture = /fireEvent\.pointer(?:Down|Up|Cancel)\(([^,)]+)/;
  const click = /(?:fireEvent|user|userEvent)\.click\(([^,)]+)/;
  for (const file of uiFiles(game, 'test')) {
    const lines = readFileSync(file, 'utf8').split('\n');
    let touched = new Set<string>();
    for (const line of lines) {
      if (opensCase.test(line)) touched = new Set();
      const pressed = gesture.exec(line);
      if (pressed) {
        touched.add(pressed[1]!.trim());
        continue;
      }
      const clicked = click.exec(line);
      if (clicked && touched.has(clicked[1]!.trim())) return true;
    }
  }
  return false;
}

describe('a board hears the pointer being taken away (issue #169)', () => {
  it('is looking at the collection the registry ships', () => {
    // Not `readdirSync` alone: a folder the registry does not carry is not a
    // game, and a game the registry carries without a folder is a broken
    // build. The sibling gates cross-check the same way.
    const folders = readdirSync(GAMES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(folders).toEqual([...ids]);
    // And a scan that has stopped matching anything must fail loudly rather
    // than excusing every game at once.
    expect(withPress.length).toBeGreaterThanOrEqual(12);
    expect(held.length).toBeGreaterThanOrEqual(9);
    expect(clickAdjacent.length).toBeGreaterThanOrEqual(8);
  });

  it('excuses only presses that still hold nothing', () => {
    // The reasons are prose and cannot be checked. What can: an excused board
    // that starts tracking the finger or taking the pointer is no longer the
    // board the reason was written about.
    const stale: string[] = [];
    for (const board of excused) {
      const reason = PRESSES_THAT_HOLD_NOTHING[board.game]!;
      if (reason.trim().length === 0) stale.push(`${board.game}: excused with no reason given`);
      if (board.tags.some((tag) => tag.props.has('onPointerMove'))) {
        stale.push(`${board.game}: now wires onPointerMove — it tracks the finger after all`);
      }
      for (const [file, text] of board.sources) {
        if (text.includes('setPointerCapture(')) {
          stale.push(`${board.game}: ${relative(file)} now takes the pointer (setPointerCapture)`);
        }
      }
    }
    expect(
      stale,
      `a press that holds something must hear pointercancel; rewrite the entry in ` +
        `PRESSES_THAT_HOLD_NOTHING or wire the cancel:\n${stale.join('\n')}`,
    ).toEqual([]);

    const unknown = Object.keys(PRESSES_THAT_HOLD_NOTHING).filter(
      (game) => !withPress.some((board) => board.game === game),
    );
    expect(
      unknown,
      `excused games that no longer hear a press at all: ${unknown.join(', ')}`,
    ).toEqual([]);
  });

  it('hears a cancel wherever it hears a release', () => {
    // Element by element, because a file-wide answer is the bug: Block Puzzle
    // takes the pointer on the tray slot and hears the release on the body,
    // and a cancel wired to the wrong one of the two is not wired at all.
    const offenders: string[] = [];
    for (const board of held) {
      for (const tag of board.tags) {
        if (!tag.props.has('onPointerUp') || tag.props.has('onPointerCancel')) continue;
        offenders.push(
          `${board.game}: <${tag.name}> at ${relative(tag.file)}:${tag.line} takes ` +
            `onPointerUp with no onPointerCancel beside it`,
        );
      }
      if (!board.tags.some((tag) => tag.props.has('onPointerCancel'))) {
        offenders.push(`${board.game}: nothing in its ui/ hears pointercancel at all`);
      }
    }
    expect(
      offenders,
      `a pointercancel is the platform saying no pointerup is coming — a board that only ` +
        `listens for the release keeps whatever the press armed:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('answers the cancel with the gesture the release ends, not with a shrug', () => {
    // Weak on purpose, and the only static half of "the same clean-up" there
    // is: when the two handlers differ, they must at least be about the same
    // gesture — the cancel touching one of the refs the release touches. What
    // each does with it is behaviour, and belongs to the game's own tests.
    const offenders: string[] = [];
    let compared = 0;
    for (const board of held) {
      for (const tag of board.tags) {
        const up = tag.props.get('onPointerUp');
        const cancel = tag.props.get('onPointerCancel');
        if (!up || !cancel) continue;
        const where = `${board.game}: <${tag.name}> at ${relative(tag.file)}:${tag.line}`;
        if (
          /^(?:undefined|null)$/.test(cancel) ||
          /^\(\s*\)\s*=>\s*(?:\{\s*\}|undefined)$/.test(cancel)
        ) {
          offenders.push(`${where} answers the cancel with a no-op (${cancel})`);
          continue;
        }
        if (up === cancel) continue;
        const text = board.sources.get(tag.file)!;
        const upBody = handlerBody(text, up);
        const cancelBody = handlerBody(text, cancel);
        if (upBody === null || cancelBody === null) continue;
        compared++;
        const shared = [...refsIn(upBody)].filter((ref) => refsIn(cancelBody).has(ref));
        if (shared.length === 0) {
          offenders.push(
            `${where} answers the cancel with ${cancel}, which touches none of the refs ` +
              `${up} does — the press's own state is left standing`,
          );
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
    // A resolution that has quietly stopped matching would pass the loop above
    // by comparing nothing at all.
    expect(compared).toBeGreaterThanOrEqual(5);
  });

  it("proves the cancel in the game's own tests, where the meaning of it lives", () => {
    const missing = held
      .filter((board) => !testText(board.game).includes('fireEvent.pointerCancel('))
      .map((board) => board.game);
    expect(
      missing,
      `no test in ui/ drives a pointercancel: the wiring above says the event is heard, and ` +
        `only the game can say what it should mean (${missing.join(', ')})`,
    ).toEqual([]);
  });

  it('spends the click a gesture leaves behind, and proves that too', () => {
    const missing = clickAdjacent
      .filter((board) => !coversTrailingClick(board.game))
      .map((board) => board.game);
    expect(
      missing,
      `a press on one of these boards can end on a control that also hears a click, so a ` +
        `gesture plays twice unless the click is marked spent — no test presses and then ` +
        `clicks the same element (${missing.join(', ')})`,
    ).toEqual([]);
  });
});
