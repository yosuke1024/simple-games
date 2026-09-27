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
  crownGridHintSingle_row:
    'Die hervorgehobene Zeile hat nur noch ein Feld für ihre Krone: das umrandete.',
  crownGridHintSingle_col:
    'Die hervorgehobene Spalte hat nur noch ein Feld für ihre Krone: das umrandete.',
  crownGridHintSingle_region:
    'Das hervorgehobene Gebiet hat nur noch ein Feld für seine Krone: das umrandete.',
  crownGridHintConfine_regionRow:
    'Das hervorgehobene Gebiet kann seine Krone nur auf den eingefärbten Feldern haben, die alle in einer Zeile liegen — die übrigen Felder dieser Zeile (umrandet) sind damit ausgeschlossen.',
  crownGridHintConfine_regionCol:
    'Das hervorgehobene Gebiet kann seine Krone nur auf den eingefärbten Feldern haben, die alle in einer Spalte liegen — die übrigen Felder dieser Spalte (umrandet) sind damit ausgeschlossen.',
  crownGridHintConfine_rowRegion:
    'Die hervorgehobene Zeile kann ihre Krone nur auf den eingefärbten Feldern haben, die alle in einem Gebiet liegen — die übrigen Felder dieses Gebiets (umrandet) sind damit ausgeschlossen.',
  crownGridHintConfine_colRegion:
    'Die hervorgehobene Spalte kann ihre Krone nur auf den eingefärbten Feldern haben, die alle in einem Gebiet liegen — die übrigen Felder dieses Gebiets (umrandet) sind damit ausgeschlossen.',
  crownGridHintAttack_row:
    'Eine Krone auf dem umrandeten Feld würde jedes eingefärbte Feld ausschließen und der hervorgehobenen Zeile keinen Platz mehr für ihre Krone lassen.',
  crownGridHintAttack_col:
    'Eine Krone auf dem umrandeten Feld würde jedes eingefärbte Feld ausschließen und der hervorgehobenen Spalte keinen Platz mehr für ihre Krone lassen.',
  crownGridHintAttack_region:
    'Eine Krone auf dem umrandeten Feld würde jedes eingefärbte Feld ausschließen und dem hervorgehobenen Gebiet keinen Platz mehr für seine Krone lassen.',
  crownGridHintPair_regionsRows:
    'Die beiden hervorgehobenen Gebiete können ihre Kronen nur auf den eingefärbten Feldern haben, die zusammen in genau zwei Zeilen liegen — die übrigen Felder dieser Zeilen (umrandet) sind damit ausgeschlossen.',
  crownGridHintPair_regionsCols:
    'Die beiden hervorgehobenen Gebiete können ihre Kronen nur auf den eingefärbten Feldern haben, die zusammen in genau zwei Spalten liegen — die übrigen Felder dieser Spalten (umrandet) sind damit ausgeschlossen.',
  crownGridHintPair_rowsRegions:
    'Die beiden hervorgehobenen Zeilen können ihre Kronen nur auf den eingefärbten Feldern haben, die zusammen in genau zwei Gebieten liegen — die übrigen Felder dieser Gebiete (umrandet) sind damit ausgeschlossen.',
  crownGridHintPair_colsRegions:
    'Die beiden hervorgehobenen Spalten können ihre Kronen nur auf den eingefärbten Feldern haben, die zusammen in genau zwei Gebieten liegen — die übrigen Felder dieser Gebiete (umrandet) sind damit ausgeschlossen.',
  crownGridHintHypothesis_row:
    'Versuche eine Krone auf dem umrandeten Feld: Die dadurch erzwungenen Züge lassen der hervorgehobenen Zeile keinen Platz mehr für ihre Krone — dort kann also keine stehen.',
  crownGridHintHypothesis_col:
    'Versuche eine Krone auf dem umrandeten Feld: Die dadurch erzwungenen Züge lassen der hervorgehobenen Spalte keinen Platz mehr für ihre Krone — dort kann also keine stehen.',
  crownGridHintHypothesis_region:
    'Versuche eine Krone auf dem umrandeten Feld: Die dadurch erzwungenen Züge lassen dem hervorgehobenen Gebiet keinen Platz mehr für seine Krone — dort kann also keine stehen.',
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
