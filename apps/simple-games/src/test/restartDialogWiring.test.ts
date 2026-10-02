/**
 * The ↻ in a game's top bar asks one question, and offers what the result
 * card offers (docs/ARCHITECTURE.md「シェルの枠とゲームの中身」, 「ヘッダの ↻ は
 * 結果カードと同じ 2 択」).
 *
 * Before 2026-10-02 it was a plain confirmation of "retry the same board",
 * so a player who wanted a *different* board mid-game went the long way
 * round: Home, the mode button, and a second confirmation there. Now every
 * game whose top bar is labelled `tryAgain` opens `RestartDialog`, and a game
 * whose result card already offers a fresh board (`onNewBoard` /
 * `onNewDeal` / `onNewFree`) hands the same offer to the dialog as
 * `newBoard`, so the two places never disagree about whether another board
 * exists, what it is called, or what it does. A card that offers no fresh
 * board (a level ladder, a layout you are meant to learn) keeps the header
 * to the retry alone — the dialog decides nothing from the session, it only
 * says what it was given.
 *
 * Static, like test/modalIsolationWiring.test.ts, because that is what makes
 * it a gate on the next game rather than on the forty that exist: a game
 * added tomorrow with a `tryAgain` header and a `ConfirmDialog` behind it
 * fails this the moment its screen file exists.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GAMES } from '../app/registry';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GAMES_DIR = join(SRC, 'games');

/** The result-card props through which a game offers another board. */
const CARD_FRESH_BOARD_PROP = /\bon(?:NewBoard|NewDeal|NewFree)=\{/;

interface Wiring {
  game: string;
  /** The top bar's ↻ is labelled "Retry same board". */
  retryHeader: boolean;
  /** `<RestartDialog` is rendered. */
  restartDialog: boolean;
  /** A `<ConfirmDialog` titled `tryAgain` is still rendered — the old shape. */
  legacyConfirm: boolean;
  /** The result card is handed a fresh-board action. */
  cardOffersFreshBoard: boolean;
  /** The restart dialog is handed `newBoard={…}`. */
  dialogOffersFreshBoard: boolean;
}

const wirings: Wiring[] = [];
for (const { id: game } of GAMES) {
  const text = readFileSync(join(GAMES_DIR, game, 'ui', 'screens', 'GameScreen.tsx'), 'utf8');
  wirings.push({
    game,
    retryHeader: text.includes("aria-label={t('tryAgain')}"),
    restartDialog: /<RestartDialog\b/.test(text),
    legacyConfirm: /<ConfirmDialog[\s\S]*?title=\{t\('tryAgain'\)\}/.test(text),
    cardOffersFreshBoard: CARD_FRESH_BOARD_PROP.test(text),
    dialogOffersFreshBoard: /<RestartDialog\b[\s\S]*?\bnewBoard=\{/.test(text),
  });
}

const retryHeaders = wirings.filter((w) => w.retryHeader);

describe('the ↻ in a game’s top bar', () => {
  it('asks through RestartDialog, never through the old same-board confirmation', () => {
    const legacy = wirings.filter((w) => w.legacyConfirm).map((w) => w.game);
    expect(
      legacy,
      `a ConfirmDialog titled tryAgain offers no way to a different board; use RestartDialog in: ${legacy.join(', ')}`,
    ).toEqual([]);
  });

  it('is behind every tryAgain header that confirms before restarting', () => {
    // The arcade titles restart on the spot (a run is seconds long and the
    // level is the board), so a tryAgain header with no dialog at all is
    // fine; one with a dialog must have the shared one.
    const missing = retryHeaders
      .filter((w) => !w.restartDialog && /<ConfirmDialog\b/.test(readScreen(w.game)))
      .map((w) => w.game);
    expect(
      missing,
      `tryAgain header with a ConfirmDialog but no RestartDialog in: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('offers a fresh board exactly when the result card does', () => {
    const cardOnly = wirings
      .filter((w) => w.restartDialog && w.cardOffersFreshBoard && !w.dialogOffersFreshBoard)
      .map((w) => w.game);
    expect(
      cardOnly,
      `the result card offers a fresh board but the ↻ dialog does not — pass the same offer as newBoard in: ${cardOnly.join(', ')}`,
    ).toEqual([]);

    const dialogOnly = wirings
      .filter((w) => w.dialogOffersFreshBoard && !w.cardOffersFreshBoard)
      .map((w) => w.game);
    expect(
      dialogOnly,
      `the ↻ dialog offers a fresh board the result card does not — the two must agree in: ${dialogOnly.join(', ')}`,
    ).toEqual([]);
  });

  it('found something to check', () => {
    // A scanner that reads nothing passes everything. 2026-10-02: 25 tryAgain
    // headers, 22 of them with the dialog, 17 of those offering a fresh board.
    expect(retryHeaders.length).toBeGreaterThanOrEqual(20);
    expect(wirings.filter((w) => w.restartDialog).length).toBeGreaterThanOrEqual(20);
    expect(wirings.filter((w) => w.dialogOffersFreshBoard).length).toBeGreaterThanOrEqual(15);
  });
});

function readScreen(game: string): string {
  return readFileSync(join(GAMES_DIR, game, 'ui', 'screens', 'GameScreen.tsx'), 'utf8');
}
