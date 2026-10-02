/**
 * German catalog of Number Path (docs/I18N_POLICY.md: provenance `machine` — written
 * with AI assistance and not yet read by a native speaker). The title is a proper
 * noun and stays as-is.
 */
import type { NumberPathMessages } from './en';

export const de: NumberPathMessages = {
  numberPathName: 'Number Path',
  numberPathChooseBoard: 'Feld wählen',
  numberPathDifficulty_easy: 'Leicht',
  numberPathDifficulty_medium: 'Mittel',
  numberPathDifficulty_hard: 'Schwer',
  numberPathBoardNote: '{width}×{height}',
  numberPathBoardLabel: 'Number-Path-Feld, {width} mal {height}',
  numberPathCellPlain: 'Zeile {row}, Spalte {col}',
  numberPathCellNumber: 'Zahl {n}, Zeile {row}, Spalte {col}',
  numberPathOnPath: 'auf dem Weg, Schritt {step}',
  numberPathOffPath: 'nicht auf dem Weg',
  numberPathHintNext: 'Das markierte Feld ist der nächste Schritt.',
  numberPathHintBack: 'Der Weg ist abgekommen. Geh bis zum markierten Feld zurück.',
  numberPathHintNone: 'Gerade kein Hinweis.',
  numberPathHintMarked: 'Hinweis',
  numberPathSolvedTitle: 'Gelöst!',
  numberPathSolvedBody: 'Eine Linie, jedes Feld, der Reihe nach.',
  numberPathHintsUsed: 'Genutzte Hinweise',
  numberPathNewBestTime: 'Deine bisher schnellste Zeit.',
  numberPathNewBoard: 'Neues Feld',
  numberPathSolvedCount: 'Gelöste Rätsel',
  numberPathDailySection: 'Täglich',
  numberPathDailiesSolved: 'Gelöste Tage',
  numberPathStep1Title: 'Den Zahlen folgen',
  numberPathStep1Body:
    'Zieh eine einzige Linie von der 1 aus und geh die Zahlen der Reihe nach ab.',
  numberPathStep2Title: 'Jedes Feld abdecken',
  numberPathStep2Body:
    'Die Linie führt genau einmal durch jedes Feld und endet auf der letzten Zahl.',
  numberPathStep3Title: 'Wände versperren den Weg',
  numberPathStep3Body:
    'Über eine dicke Kante geht es nicht; zum Zurückgehen die Linie rückwärts nachziehen oder ein Feld darauf antippen.',
};
