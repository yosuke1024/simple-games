import type { CrownGridMessages } from './en';

export const de: CrownGridMessages = {
  crownGridName: 'Crown Grid',
  crownGridChooseBoard: 'Feld wählen',
  crownGridDifficulty_easy: 'Leicht',
  crownGridDifficulty_medium: 'Mittel',
  crownGridDifficulty_hard: 'Schwer',
  crownGridBoardNote: '{size}×{size}',
  crownGridConfirmSwitchTitle: 'Laufendes Feld ersetzen?',
  crownGridConfirmSwitchBody: 'Dein Spiel {current} wird durch ein neues Feld {next} ersetzt.',
  crownGridBoardLabel: 'Crown-Grid-Feld, {size} mal {size}',
  crownGridCellEmpty: 'Leer, Zeile {row}, Spalte {col}, Gebiet {region}',
  crownGridCellCross: 'Ausgekreuzt, Zeile {row}, Spalte {col}, Gebiet {region}',
  crownGridCellCrown: 'Krone, Zeile {row}, Spalte {col}, Gebiet {region}',
  crownGridRuleBroken: 'verstößt gegen eine Regel',
  crownGridHintViolation: 'Die hervorgehobenen Kronen verstoßen gegen eine Regel.',
  crownGridHintWrong: 'Die markierte Krone kann nicht stimmen.',
  crownGridHintPlace:
    'Auf das markierte Feld gehört eine Krone – der hervorgehobene Bereich zeigt, warum.',
  crownGridHintEliminate:
    'Auf die markierten Felder kann keine Krone – der hervorgehobene Bereich zeigt, warum.',
  crownGridHintNone: 'Gerade ist kein sicherer Zug zu finden.',
  crownGridSolvedTitle: 'Gelöst!',
  crownGridSolvedBody: 'Jede Zeile, jede Spalte und jedes Gebiet hält eine Krone.',
  crownGridHintsUsed: 'Verwendete Hinweise',
  crownGridNewBestTime: 'Deine bisher schnellste Zeit.',
  crownGridNewBoard: 'Neues Feld',
  crownGridDailySection: 'Täglich',
  crownGridDailiesSolved: 'Gelöste Tage',
  crownGridDailyBacklogHint: 'Jeder frühere Tag bleibt offen.',
  crownGridStep1Title: 'Je eine Krone',
  crownGridStep1Body: 'Jede Zeile, jede Spalte und jede Farbe hält genau eine Krone.',
  crownGridStep2Title: 'Kronen berühren sich nie',
  crownGridStep2Body: 'Zwei Kronen dürfen nicht nebeneinander stehen, auch nicht diagonal.',
  crownGridStep3Title: 'Tippen und ziehen',
  crownGridStep3Body:
    'Tippe ein Feld für ×, Krone, leer; ziehe, um mehrere × zu setzen. Steckst du fest? Frag nach einem Hinweis.',
};
