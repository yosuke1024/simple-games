/**
 * A modal (confirm dialog) or the result overlay never lets the keyboard
 * reach the game behind it (issue #120).
 *
 * Two things have to be true at once, and each fails in its own quiet way if
 * missing. `useGameKeys`' `enabled` argument detaches the window-level key
 * listener, so it stops keys the game itself would act on — but a focused
 * board button still answers Enter/Space to its own click handler, because
 * that answer is the browser's, not `useGameKeys`'. And the dialog's `.overlay`
 * stops pointers, not focus: its autofocused Cancel button is one Shift+Tab
 * from the last focusable control on the board, so a screen reader user or
 * anyone tabbing can reach it without a mouse ever leaving the dialog. The
 * fix for both is the same one attribute: `.game-content` must be `inert`
 * while a `ConfirmDialog` is open, using the same flag the dialog's own
 * `open` prop reads (docs/ARCHITECTURE.md「モーダルの間、盤面は inert」).
 *
 * That was not the state of the code. Measured 2026-09-05: of the 25 games
 * with a `ConfirmDialog`, only 7 already included its flag in the
 * `.game-content` `inert` expression — `scripts/codemods/2026-09-05-inert-
 * during-confirm-dialog.mjs` brought the other 18 in line, in the same
 * commit as the measurement. `useGameKeys`'s `enabled` argument has the
 * matching half of the contract: it must go false on the same flag (directly,
 * or through a `blocked` value the flag feeds and the handler tests — 2048's
 * shape, where arrow keys stay swallowed so the page cannot scroll under a
 * held key, but nothing on the board moves while blocked).
 *
 * Static, like test/refLeading.test.ts and test/shortcutResumeWiring.test.ts,
 * because that is what makes it a gate on the next game rather than on the
 * thirty that exist: a game added tomorrow that renders a `ConfirmDialog` or
 * calls `useGameKeys` meets this the moment its screen file exists, without
 * anyone remembering to wire it by hand.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GAMES } from '../app/registry';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GAMES_DIR = join(SRC, 'games');

/** How far past `<ConfirmDialog` the matching `open={FLAG}` line may sit. */
const OPEN_PROP_WINDOW = 12;

/**
 * The index in `text` matching the bracket at `openIndex` (`(` with `)`, or
 * `{` with `}`), by depth — good enough for source that is not hand-crafting
 * unbalanced brackets inside a string to fool it, which none of these files do.
 */
function matchingClose(text: string, openIndex: number): number {
  const open = text[openIndex];
  const close = open === '(' ? ')' : open === '{' ? '}' : null;
  if (!close) throw new Error(`unsupported bracket: ${open}`);
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

/** Top-level comma-separated pieces of a call's argument list. */
function splitTopLevelArgs(argsText: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of argsText) {
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    if (ch === ')' || ch === '}' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      args.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) args.push(current);
  return args;
}

const wholeWord = (name: string): RegExp => new RegExp(`\\b${name}\\b`);

interface DialogWiring {
  game: string;
  /** The identifier the dialog's `open={…}` reads, or null if not found. */
  flag: string | null;
  /** The `.game-content` `inert={…}` expression, or null if the div is missing. */
  inertExpr: string | null;
  /** True once the `.game-content` block's matching `</div>` was located. */
  contentCloseFound: boolean;
  /** True when `<ConfirmDialog` sits after that closing `</div>`. */
  dialogAfterContent: boolean;
}

interface KeysWiring {
  game: string;
  /** The dialog flag this game guards with (from DialogWiring), if any. */
  flag: string | null;
  secondArgExists: boolean;
  secondArg: string;
  /** `!FLAG` appears directly in the second argument. */
  shapeDirect: boolean;
  /** A `const blocked = …FLAG…` feeds the flag, and the handler tests it. */
  shapeBlocked: boolean;
  /** For a game with no ConfirmDialog: the guard still reads game-over state. */
  mentionsOutcome: boolean;
}

const dialogWirings: DialogWiring[] = [];
const keysWirings: KeysWiring[] = [];
const gamesRead: string[] = [];

for (const { id: game } of GAMES) {
  const path = join(GAMES_DIR, game, 'ui', 'screens', 'GameScreen.tsx');
  const text = readFileSync(path, 'utf8');
  gamesRead.push(game);
  const lines = text.split('\n');

  let flag: string | null = null;
  if (text.includes('<ConfirmDialog')) {
    const dialogLineIndex = lines.findIndex((line) => line.includes('<ConfirmDialog'));
    for (
      let i = dialogLineIndex;
      i < Math.min(lines.length, dialogLineIndex + OPEN_PROP_WINDOW);
      i++
    ) {
      const match = /open=\{(\w+)\}/.exec(lines[i]!);
      if (match) {
        flag = match[1]!;
        break;
      }
    }

    const contentLineIndex = lines.findIndex((line) =>
      /<div className="game-content" inert=\{(.+)\}>/.test(line),
    );
    const inertMatch =
      contentLineIndex >= 0
        ? /<div className="game-content" inert=\{(.+)\}>/.exec(lines[contentLineIndex]!)
        : null;
    const indent = contentLineIndex >= 0 ? /^(\s*)/.exec(lines[contentLineIndex]!)![1]! : '';
    let contentCloseLineIndex = -1;
    if (contentLineIndex >= 0) {
      for (let i = contentLineIndex + 1; i < lines.length; i++) {
        if (lines[i] === `${indent}</div>`) {
          contentCloseLineIndex = i;
          break;
        }
      }
    }

    dialogWirings.push({
      game,
      flag,
      inertExpr: inertMatch ? inertMatch[1]! : null,
      contentCloseFound: contentCloseLineIndex >= 0,
      dialogAfterContent: contentCloseLineIndex >= 0 && dialogLineIndex > contentCloseLineIndex,
    });
  }

  if (text.includes('useGameKeys(')) {
    const callIndex = text.indexOf('useGameKeys(');
    const openParenIndex = callIndex + 'useGameKeys'.length;
    const closeParenIndex = matchingClose(text, openParenIndex);
    const args = splitTopLevelArgs(text.slice(openParenIndex + 1, closeParenIndex));
    const secondArg = (args[1] ?? '').trim();

    let shapeDirect = false;
    let shapeBlocked = false;
    let mentionsOutcome = false;

    if (flag) {
      shapeDirect = new RegExp(`!${flag}\\b`).test(secondArg);
      if (!shapeDirect) {
        const blockedMatch = /const blocked = ([^;]+);/.exec(text);
        if (blockedMatch && wholeWord(flag).test(blockedMatch[1]!)) {
          const onKeyMatch = /const onKey = \(event: KeyboardEvent\): boolean => \{/.exec(text);
          if (onKeyMatch) {
            const braceIndex = text.indexOf('{', onKeyMatch.index);
            const closeBraceIndex = matchingClose(text, braceIndex);
            const body = text.slice(braceIndex, closeBraceIndex);
            shapeBlocked = wholeWord('blocked').test(body);
          }
        }
      }
    } else {
      mentionsOutcome = /\bstatus\b|\bfinished\b|\bover\b|\bwon\b|\bsolved\b/.test(secondArg);
    }

    keysWirings.push({
      game,
      flag,
      secondArgExists: args.length >= 2,
      secondArg,
      shapeDirect,
      shapeBlocked,
      mentionsOutcome,
    });
  }
}

describe('a modal keeps the board behind it from answering the keyboard (issue #120)', () => {
  it("finds the flag a ConfirmDialog's open prop reads, in every game that renders one", () => {
    const missing = dialogWirings.filter((w) => w.flag === null).map((w) => w.game);
    expect(
      missing,
      `no \`open={…}\` found within ${OPEN_PROP_WINDOW} lines of <ConfirmDialog> in: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('inerts .game-content on that same flag while the dialog is open', () => {
    const offenders = dialogWirings
      .filter((w) => w.flag !== null)
      .filter((w) => w.inertExpr === null || !wholeWord(w.flag!).test(w.inertExpr))
      .map(
        (w) =>
          `${w.game}: inert={${w.inertExpr ?? '<.game-content not found>'}} does not reference ${w.flag}`,
      );
    expect(
      offenders,
      `a dialog's open flag must appear in .game-content's inert expression, or the board behind ` +
        `it stays focusable while it is open (docs/ARCHITECTURE.md「モーダルの間、盤面は inert」):\n` +
        offenders.join('\n'),
    ).toEqual([]);
  });

  it('renders ConfirmDialog outside .game-content, never as one of its inerted children', () => {
    // inert on an ancestor would take the dialog itself down with the board —
    // the two must be siblings, dialog after the content block closes.
    const offenders = dialogWirings
      .filter((w) => !w.contentCloseFound || !w.dialogAfterContent)
      .map((w) => w.game);
    expect(
      offenders,
      `<ConfirmDialog> must come after .game-content's closing </div> in: ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it('finds a second (enabled) argument on every useGameKeys call', () => {
    const missing = keysWirings.filter((w) => !w.secondArgExists).map((w) => w.game);
    expect(
      missing,
      `useGameKeys must be given an explicit enabled argument, or its default (always-on) leaves ` +
        `the window key listener attached under a modal: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('disables useGameKeys while its ConfirmDialog is open, directly or through a tested `blocked`', () => {
    const offenders = keysWirings
      .filter((w) => w.flag !== null)
      .filter((w) => !w.shapeDirect && !w.shapeBlocked)
      .map(
        (w) =>
          `${w.game}: useGameKeys(onKey, ${w.secondArg}) neither negates ${w.flag} directly nor ` +
          `routes it through a \`blocked\` the key handler tests`,
      );
    expect(
      offenders,
      `enabled must go false with the dialog's own flag — a window listener left attached still ` +
        `answers Enter/Space through a focused board button once .overlay is up:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('gates a dialog-less useGameKeys on the game actually being over', () => {
    const offenders = keysWirings
      .filter((w) => w.flag === null)
      .filter((w) => !w.mentionsOutcome)
      .map((w) => `${w.game}: useGameKeys(onKey, ${w.secondArg})`);
    expect(
      offenders,
      `a game with no ConfirmDialog still needs its useGameKeys enabled argument to read a ` +
        `finished/over/won/solved status — otherwise there is nothing here stopping input once ` +
        `the result overlay is up:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('read every registry game, and both kinds of gate matched at least one', () => {
    // A guard that silently matched nothing would pass every test above while
    // checking nothing at all — the two failure modes this exists to catch.
    expect(gamesRead.sort()).toEqual(GAMES.map((g) => g.id).sort());
    expect(dialogWirings.length).toBeGreaterThan(0);
    expect(keysWirings.length).toBeGreaterThan(0);
  });
});
