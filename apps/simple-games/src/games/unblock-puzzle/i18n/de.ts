/**
 * German catalog for Unblock Puzzle. Provenance: `machine` — written with
 * AI assistance from the English source; no native speaker has read it
 * (docs/UNBLOCK_PUZZLE_RULES.md §15, docs/I18N_POLICY.md「翻訳の状態は来歴と
 * 検証できた事実で書く」). The title (`unblockPuzzleName`) is a proper noun and
 * stays as-is in every locale; placeholder names match the English source.
 * Shared words (Undo, Hint, Moves, Daily Challenge, …) follow the shell's
 * src/i18n/locales/de.ts.
 */
import type { UnblockPuzzleMessages } from './en';

export const de: UnblockPuzzleMessages = {
  unblockPuzzleName: 'Unblock Puzzle',
  unblockPuzzleChooseBoard: 'Feld wählen',
  unblockPuzzleDifficulty_easy: 'Leicht',
  unblockPuzzleDifficulty_medium: 'Mittel',
  unblockPuzzleDifficulty_hard: 'Schwer',
  unblockPuzzleRange: '{min}–{max} Züge',
  unblockPuzzleRangeOpen: 'ab {min} Zügen',
  unblockPuzzleConfirmSwitchTitle: 'Laufendes Feld ersetzen?',
  unblockPuzzleConfirmSwitchBody: 'Dein Feld {current} wird durch ein neues Feld {next} ersetzt.',
  unblockPuzzleBoardLabel:
    'Feld, {cols} mal {rows}. Der Ausgang liegt am rechten Ende von Zeile {row}.',
  unblockPuzzleBlockTarget:
    'Zielblock, Zeile {row}, Spalten {from} bis {to}. Freie Zellen: {left} links, {right} rechts.',
  unblockPuzzleBlockH:
    'Waagerechter Block, Zeile {row}, Spalten {from} bis {to}. Freie Zellen: {left} links, {right} rechts.',
  unblockPuzzleBlockV:
    'Senkrechter Block, Spalte {col}, Zeilen {from} bis {to}. Freie Zellen: {up} oben, {down} unten.',
  unblockPuzzleMovesStatus: 'Züge {moves} · mindestens {min}',
  unblockPuzzleMoveLeft: 'Nach links schieben',
  unblockPuzzleMoveRight: 'Nach rechts schieben',
  unblockPuzzleMoveUp: 'Nach oben schieben',
  unblockPuzzleMoveDown: 'Nach unten schieben',
  unblockPuzzleSelectPrompt: 'Tippe auf einen Block, um ihn zu schieben',
  unblockPuzzleHintTarget: 'Tipp: Schiebe den Zielblock auf die Spalten {toFrom}–{toTo}.',
  unblockPuzzleHintH:
    'Tipp: Schiebe den Block in Zeile {row}, Spalten {from}–{to}, auf die Spalten {toFrom}–{toTo}.',
  unblockPuzzleHintV:
    'Tipp: Schiebe den Block in Spalte {col}, Zeilen {from}–{to}, auf die Zeilen {toFrom}–{toTo}.',
  unblockPuzzleHintShown: 'Schiebe den markierten Block in den Umriss.',
  unblockPuzzleHintNone: 'Von hier aus wurde kein Zug gefunden.',
  unblockPuzzleSolvedTitle: 'Geschafft!',
  unblockPuzzleSolvedBody: 'Der Zielblock ist draußen.',
  unblockPuzzleSolvedOptimal: 'Mit den wenigsten Zügen draußen.',
  unblockPuzzleFewestLabel: 'Minimum',
  unblockPuzzleNetCellsLabel: 'Netto bewegte Zellen',
  unblockPuzzleHintsUsed: 'Genutzte Tipps',
  unblockPuzzleNewBestTime: 'Neue Bestzeit auf {difficulty}.',
  unblockPuzzleNewBestDailyMoves: 'Heute so wenige Züge wie nie.',
  unblockPuzzleNewBoard: 'Neues Feld',
  unblockPuzzleSolvedCount: 'Gelöste Felder',
  unblockPuzzleOptimalCount: 'Mit Mindestzügen gelöst',
  unblockPuzzleOverallSection: 'Gesamt',
  unblockPuzzleDailiesCleared: 'Gelöste Tagesrätsel',
  unblockPuzzleStep1Title: 'Entlang der Linie schieben',
  unblockPuzzleStep1Body:
    'Jeder Block gleitet nur entlang seiner Linie: seitwärts oder auf und ab.',
  unblockPuzzleStep2Title: 'Den Zielblock befreien',
  unblockPuzzleStep2Body:
    'Schiebe den Zielblock rechts durch den Ausgang hinaus, um das Feld zu lösen.',
  unblockPuzzleStep3Title: 'Ein Schub, ein Zug',
  unblockPuzzleStep3Body:
    'Ein Schub zählt als ein Zug, egal wie weit, und Rückgängig und Tipp sind immer da.',
};
