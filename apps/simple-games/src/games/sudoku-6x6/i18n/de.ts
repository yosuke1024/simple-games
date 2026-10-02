/**
 * German catalog for Sudoku 6×6 — a machine translation of the English
 * source, not yet reviewed (docs/I18N_POLICY.md). The title
 * (`sudoku6x6Name`) is a proper noun. Wording follows the 9×9 Sudoku
 * catalog wherever the meaning is the same.
 */
import type { Sudoku6x6Messages } from './en';

export const de: Sudoku6x6Messages = {
  sudoku6x6Name: 'Sudoku 6×6',
  sudoku6x6ChooseBoard: 'Wähle ein Brett',
  sudoku6x6Difficulty_easy: 'Leicht',
  sudoku6x6Difficulty_medium: 'Mittel',
  sudoku6x6Difficulty_hard: 'Schwer',
  sudoku6x6ConfirmSwitchTitle: 'Laufendes Brett ersetzen?',
  sudoku6x6ConfirmSwitchBody: 'Dein {current}-Spiel wird durch ein neues {next}-Brett ersetzt.',
  sudoku6x6GridLabel: 'Sudoku-6×6-Gitter',
  sudoku6x6PadLabel: 'Zahlenfeld',
  sudoku6x6PadKey: '{value}, noch {n}',
  sudoku6x6PadNoteKey: 'Notiz {value}',
  sudoku6x6CellEmpty: 'Leer, Zeile {row}, Spalte {col}',
  sudoku6x6CellGiven: '{value}, vorgegeben, Zeile {row}, Spalte {col}',
  sudoku6x6CellEntry: '{value}, Zeile {row}, Spalte {col}',
  sudoku6x6Erase: 'Löschen',
  sudoku6x6Notes: 'Notizen',
  sudoku6x6HintOnlyDigit: 'In dieses Feld passt nur eine Ziffer.',
  sudoku6x6HintOnlyCell: 'Nur hier kann {value} stehen.',
  sudoku6x6HintLockedLine: 'In dieser Box passt {value} nur in die markierte Linie.',
  sudoku6x6HintLockedBox: 'In dieser Linie passt {value} nur in die markierte Box.',
  sudoku6x6HintRuledOut: 'Diese Felder schließen die Ziffern anderswo in der Einheit aus.',
  sudoku6x6HintNone: 'Hier lässt sich noch nichts folgern.',
  sudoku6x6SolvedTitle: 'Gelöst!',
  sudoku6x6SolvedBody: 'Jede Zeile, Spalte und Box enthält 1-6.',
  sudoku6x6Mistakes: 'Fehler',
  sudoku6x6HintsUsed: 'Genutzte Tipps',
  sudoku6x6NewBestTime: 'Deine bisher schnellste Zeit.',
  sudoku6x6NewBoard: 'Neues Brett',
  sudoku6x6DailySection: 'Täglich',
  sudoku6x6DailiesSolved: 'Gelöste Tage',
  sudoku6x6HighlightMistakes: 'Fehler anzeigen',
  sudoku6x6HighlightMistakesNote:
    'Markiert eine falsche Ziffer, sobald sie gesetzt wird. Doppelte werden immer markiert.',
  sudoku6x6Step1Title: '1-6, je einmal',
  sudoku6x6Step1Body: 'Jede Zeile, Spalte und 2×3-Box enthält 1 bis 6 genau einmal.',
  sudoku6x6Step2Title: 'Füllen und notieren',
  sudoku6x6Step2Body:
    'Wähle ein Feld und tippe auf eine Zahl. Schalte Notizen ein, um Kandidaten einzutragen.',
  sudoku6x6Step3Title: 'Fest? Hol dir einen Tipp',
  sudoku6x6Step3Body: 'Ein Tipp zeigt das nächste Feld, dessen du sicher sein kannst, und warum.',
};
