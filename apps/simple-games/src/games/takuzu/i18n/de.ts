import type { TakuzuMessages } from './en';

export const de: TakuzuMessages = {
  takuzuName: 'Takuzu',
  takuzuBoardLabel: 'Takuzu-Feld, {size} mal {size}',
  takuzuCellEmpty: 'Leer, Zeile {row}, Spalte {col}',
  takuzuCellZero: '0, Zeile {row}, Spalte {col}',
  takuzuCellOne: '1, Zeile {row}, Spalte {col}',
  takuzuCellFixed: '{digit}, vorgegeben, Zeile {row}, Spalte {col}',
  takuzuRuleBroken: 'verstößt gegen eine Regel',
  takuzuSizeLabel: '{n}×{n}',
  takuzuHintFound: 'Die hervorgehobene Linie legt das markierte Feld fest.',
  takuzuHintBroken: 'Die hervorgehobene Linie verstößt gegen eine Regel.',
  takuzuHintNone: 'Gerade ist kein sicherer Zug zu finden.',
  takuzuSolvedTitle: 'Gelöst!',
  takuzuSolvedBody: 'Alle Zeilen und Spalten stimmen.',
  takuzuHintsUsed: 'Verwendete Hinweise',
  takuzuNewBestTime: 'Deine schnellste Zeit.',
  takuzuLevelsSolved: 'Gelöste Level',
  takuzuDailiesSolved: 'Gelöste Tagesrätsel',
  takuzuDailyBacklogHint: 'Jeder frühere Tag bleibt offen.',
  takuzuStep1Title: 'Nie drei in Folge',
  takuzuStep1Body:
    'Tippe ein Feld an, um zwischen 0, 1 und leer zu wechseln. Dieselbe Ziffer darf nicht dreimal in Folge stehen.',
  takuzuStep2Title: 'Halbe-halbe',
  takuzuStep2Body: 'Jede Zeile und jede Spalte enthält gleich viele 0 wie 1.',
  takuzuStep3Title: 'Keine Linie doppelt',
  takuzuStep3Body: 'Keine zwei Zeilen dürfen gleich sein, und keine zwei Spalten.',
};
