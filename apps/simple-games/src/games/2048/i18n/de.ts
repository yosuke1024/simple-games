import type { Game2048Messages } from './en';

export const de: Game2048Messages = {
  mergeName: '2048',
  mergeBoardLabel: '2048-Feld, 4 mal 4',
  mergeCell: 'Zeile {row}, Spalte {col}: {value}',
  mergeCellEmpty: 'Zeile {row}, Spalte {col}: leer',
  mergeBestScore: 'Beste Punktzahl',
  mergeBestTile: 'Größte Kachel',
  mergeReachedCount: 'Wie oft du 2048 erreicht hast',
  mergeReachedTitle: 'Du hast 2048 erreicht!',
  mergeReachedBody: 'Spiel weiter — das Feld ist noch offen.',
  mergeKeepGoing: 'Weiterspielen',
  mergeOverTitle: 'Keine Züge mehr',
  mergeOverBody: 'Jedes Feld ist belegt und nichts lässt sich mehr verbinden.',
  mergeNewBestScore: 'Deine bisher beste Punktzahl.',
  mergeStep1Title: 'Wischen zum Schieben',
  mergeStep1Body:
    'Alle Kacheln rutschen gleichzeitig in diese Richtung, und zwei gleiche Zahlen werden eine.',
  mergeStep2Title: 'Eine neue Kachel erscheint',
  mergeStep2Body: 'Nach jedem Zug, der das Feld verändert, kommt eine Kachel dazu.',
  mergeStep3Title: 'Steckengeblieben? Zurücknehmen',
  mergeStep3Body:
    'Rückgängig ist gratis und unbegrenzt und würfelt die eben erhaltene Kachel nie neu.',
};
