/**
 * Nested Tic-Tac-Toe — the German catalog. Provenance
 * (docs/NESTED_TIC_TAC_TOE_RULES.md §12): `machine` — written by an AI from
 * the English source on 2026-10-21; no native speaker has read it. The title
 * (`nestedTicTacToeName`) is a proper noun and stays as-is.
 *
 * Glossary (§12), one word each: small board = kleines Brett · square = Feld
 * · send = schicken · take / taken = erobern / erobert (never "gewinnen",
 * which is the match) · closed = geschlossen · open = offen · first / second
 * = Zuerst / Danach (as in Gomoku) · cross / circle = Kreuz / Kreis. The
 * record note puts each number after its label, as the English does, so a
 * count of 1 needs no singular.
 */
import type { NestedTicTacToeMessages } from './en';

export const de: NestedTicTacToeMessages = {
  nestedTicTacToeName: 'Nested Tic-Tac-Toe',
  nestedTicTacToeChooseOpponent: 'Wähle deinen Gegner',
  nestedTicTacToeDifficulty_easy: 'Leicht',
  nestedTicTacToeDifficulty_normal: 'Normal',
  nestedTicTacToeDifficulty_hard: 'Schwer',
  nestedTicTacToeRecordNote: 'Siege {wins} · Niederlagen {losses}',
  nestedTicTacToeChooseSideLabel: 'Wer beginnt',
  nestedTicTacToePlayFirst: 'Zuerst',
  nestedTicTacToePlaySecond: 'Danach',
  nestedTicTacToePlayFirstLabel: 'Zuerst, mit dem Kreuz',
  nestedTicTacToePlaySecondLabel: 'Danach, mit dem Kreis',
  nestedTicTacToeConfirmSwitchTitle: 'Laufende Partie ersetzen?',
  nestedTicTacToeConfirmSwitchBody:
    'Deine Partie ({current}) wird durch eine neue Partie ({next}) ersetzt.',
  nestedTicTacToeBoardLabel: 'Brett von Nested Tic-Tac-Toe, neun kleine Bretter',
  nestedTicTacToeSmallOpen: 'Kleines Brett {board}: offen',
  nestedTicTacToeSmallPlayable: 'Kleines Brett {board}: offen, hier spielen',
  nestedTicTacToeSmallMine: 'Kleines Brett {board}: von dir erobert',
  nestedTicTacToeSmallCpu: 'Kleines Brett {board}: von der CPU erobert',
  nestedTicTacToeSmallDrawn: 'Kleines Brett {board}: unentschieden (geschlossen)',
  nestedTicTacToeCellEmpty: 'Kleines Brett {board}, Feld {square}: leer',
  nestedTicTacToeCellPlayable: 'Kleines Brett {board}, Feld {square}: hier setzen',
  nestedTicTacToeCellYourCross: 'Kleines Brett {board}, Feld {square}: dein Kreuz',
  nestedTicTacToeCellYourCircle: 'Kleines Brett {board}, Feld {square}: dein Kreis',
  nestedTicTacToeCellCpuCross: 'Kleines Brett {board}, Feld {square}: Kreuz der CPU',
  nestedTicTacToeCellCpuCircle: 'Kleines Brett {board}, Feld {square}: Kreis der CPU',
  nestedTicTacToeYourTurnSent: 'Du bist dran – spiele im umrahmten Brett',
  nestedTicTacToeYourTurnFree: 'Du bist dran – spiele in einem beliebigen offenen Brett',
  nestedTicTacToeCpuTurn: 'Die CPU ist dran',
  nestedTicTacToeWinTitle: 'Du gewinnst',
  nestedTicTacToeWinBody: 'Drei deiner Bretter in einer Reihe.',
  nestedTicTacToeLoseTitle: 'Die CPU gewinnt',
  nestedTicTacToeLoseBody: 'Die CPU hat drei Bretter in einer Reihe erobert.',
  nestedTicTacToeDrawTitle: 'Unentschieden',
  nestedTicTacToeDrawBody:
    'Alle kleinen Bretter sind geschlossen, und niemand hat drei Bretter in einer Reihe.',
  nestedTicTacToeBoardsYou: 'Deine Bretter',
  nestedTicTacToeBoardsCpu: 'Bretter der CPU',
  nestedTicTacToeWins: 'Siege',
  nestedTicTacToeLosses: 'Niederlagen',
  nestedTicTacToeDraws: 'Remis',
  nestedTicTacToeStep1Title: 'Dein Zug schickt den Gegner',
  nestedTicTacToeStep1Body:
    'Wo du in einem kleinen Brett setzt, bestimmt das Brett, in dem dein Gegner als Nächstes spielt.',
  nestedTicTacToeStep2Title: 'Erobert oder voll: jedes offene Brett',
  nestedTicTacToeStep2Body:
    'Ist dieses Brett erobert oder voll, spiele in einem beliebigen offenen Brett.',
  nestedTicTacToeStep3Title: 'Drei Bretter in einer Reihe',
  nestedTicTacToeStep3Body:
    'Drei in einer Reihe erobern ein kleines Brett; drei eroberte Bretter in einer Reihe gewinnen.',
};
