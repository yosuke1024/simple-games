/**
 * German catalog for Loop Puzzle — written with AI assistance from the
 * English source (provenance `machine`, docs/LOOP_PUZZLE_RULES.md §14). No
 * native speaker has read it; it is not to be treated as reviewed. The title
 * (`loopPuzzleName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source. Terms follow the shell
 * (`hint` = Tipp) and Box Regions (board = Feld); an edge is a Kante, a drawn
 * edge a Linie, the loop a Schleife.
 */
import type { LoopPuzzleMessages } from './en';

export const de: LoopPuzzleMessages = {
  loopPuzzleName: 'Loop Puzzle',
  loopPuzzleChooseBoard: 'Feld wählen',
  loopPuzzleDifficulty_easy: 'Leicht',
  loopPuzzleDifficulty_medium: 'Mittel',
  loopPuzzleDifficulty_hard: 'Schwer',
  loopPuzzleBoardNote: '{width}×{height}',
  loopPuzzleConfirmSwitchTitle: 'Laufendes Feld ersetzen?',
  loopPuzzleConfirmSwitchBody: 'Dein Spiel {current} wird durch ein neues Feld {next} ersetzt.',
  loopPuzzleBoardLabel: 'Spielfeld von Loop Puzzle, {width} mal {height}',
  loopPuzzleEdgeHEmpty: 'Waagerechte Kante, Zeile {row}, Spalte {col}, leer',
  loopPuzzleEdgeHLine: 'Waagerechte Kante, Zeile {row}, Spalte {col}, Linie',
  loopPuzzleEdgeHCross: 'Waagerechte Kante, Zeile {row}, Spalte {col}, mit × markiert',
  loopPuzzleEdgeVEmpty: 'Senkrechte Kante, Zeile {row}, Spalte {col}, leer',
  loopPuzzleEdgeVLine: 'Senkrechte Kante, Zeile {row}, Spalte {col}, Linie',
  loopPuzzleEdgeVCross: 'Senkrechte Kante, Zeile {row}, Spalte {col}, mit × markiert',
  loopPuzzleClueOpen: 'Zahl {n}, Zeile {row}, Spalte {col}',
  loopPuzzleClueMet: 'Zahl {n}, Zeile {row}, Spalte {col}, erfüllt',
  loopPuzzleClueTooMany: 'Zahl {n}, Zeile {row}, Spalte {col}, zu viele Linien',
  loopPuzzleClueTooFew: 'Zahl {n}, Zeile {row}, Spalte {col}, nicht mehr erfüllbar',
  loopPuzzleNoteHint: 'Vom Tipp markiert',
  loopPuzzleNoteConflict: 'Verletzt eine Regel',
  loopPuzzleConflictBranch: 'An einem Punkt treffen mehr als zwei Linien zusammen.',
  loopPuzzleConflictDeadEnd: 'Eine Linie endet an einem Punkt, an dem es nicht weitergeht.',
  loopPuzzleConflictLoop: 'Außerhalb einer geschlossenen Schleife liegen noch andere Linien.',
  loopPuzzleConflictTooMany: 'Eine Zahl hat mehr Linien, als sie angibt.',
  loopPuzzleConflictTooFew: 'Eine Zahl kann nicht mehr genug Linien bekommen.',
  loopPuzzleConflictClosed: 'Die Schleife ist geschlossen, aber eine Zahl passt nicht.',
  loopPuzzleHintWrongLine: 'Die markierte Linie gehört nicht zur Schleife.',
  loopPuzzleHintWrongCross: 'Die Schleife verläuft über das markierte ×.',
  loopPuzzleHintCellLine: 'Die umkreiste Zahl braucht eine Linie auf der markierten Kante.',
  loopPuzzleHintCellCross: 'Die umkreiste Zahl lässt auf der markierten Kante keine Linie zu.',
  loopPuzzleHintDotLine: 'Am umkreisten Punkt muss die Schleife die markierte Kante nutzen.',
  loopPuzzleHintDotCross: 'Am umkreisten Punkt kann die markierte Kante keine Linie sein.',
  loopPuzzleHintLoopCross:
    'Eine Linie auf der markierten Kante würde eine Schleife zu früh schließen.',
  loopPuzzleHintClosedCross:
    'Die Schleife ist geschlossen, also gehört die markierte Kante nicht dazu.',
  loopPuzzleHintTrialLine: 'Ohne Linie auf der markierten Kante entsteht ein Widerspruch.',
  loopPuzzleHintTrialCross: 'Eine Linie auf der markierten Kante führt zu einem Widerspruch.',
  loopPuzzleHintRevealLine: 'Die markierte Kante gehört zur Schleife.',
  loopPuzzleHintRevealCross: 'Die markierte Kante gehört nicht zur Schleife.',
  loopPuzzleHintNone: 'Gerade gibt es keinen Tipp.',
  loopPuzzleSolvedTitle: 'Gelöst!',
  loopPuzzleSolvedBody: 'Eine geschlossene Schleife, jede Zahl erfüllt.',
  loopPuzzleHintsUsed: 'Genutzte Tipps',
  loopPuzzleNewBestTime: 'Deine bisher schnellste Zeit.',
  loopPuzzleNewBoard: 'Neues Feld',
  loopPuzzleSolvedCount: 'Gelöste Rätsel',
  loopPuzzleDailySection: 'Täglich',
  loopPuzzleDailiesCleared: 'Abgeschlossene Tage',
  loopPuzzleAllBoards: 'Alle Felder',
  loopPuzzleStep1Title: 'Eine geschlossene Schleife',
  loopPuzzleStep1Body:
    'Verbinde die Punkte zu einer geschlossenen Schleife, die sich nie verzweigt oder kreuzt.',
  loopPuzzleStep2Title: 'Zahlen lesen',
  loopPuzzleStep2Body: 'Eine Zahl sagt, wie viele ihrer vier Seiten die Schleife nutzt.',
  loopPuzzleStep3Title: 'Tippe auf eine Kante',
  loopPuzzleStep3Body:
    'Jedes Tippen macht eine Kante zur Linie, dann zu × (nicht auf der Schleife), dann wieder leer.',
};
