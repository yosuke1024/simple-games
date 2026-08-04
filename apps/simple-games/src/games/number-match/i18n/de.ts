import type { NumberMatchMessages } from './en';

export const de: NumberMatchMessages = {
  numberMatchName: 'Number Match',
  best: 'Rekord',
  newBest: 'Neuer Rekord!',
  scoreMatches: 'Paare',
  scoreRows: 'Reihenbonus',
  scoreClearBonus: 'Abräumbonus',
  scoreNoHint: 'Bonus ohne Tipp',
  bestScores: 'Bestwerte',
  totalBest: 'Summe aller Bestwerte',
  addNumbers: 'Nachlegen',
  boardLabel: 'Spielfeld',
  cellLabel: '{value}, Zeile {row}, Spalte {col}',
  cellLabelStone: 'Stein, Zeile {row}, Spalte {col}',
  cellLabelWild: 'Joker, Zeile {row}, Spalte {col}',
  hintNoneToast: 'Keine Paare möglich — nutze Nachlegen.',
  wildIntroToast: 'Das Feld ✦ passt zu jeder Zahl.',
  stoneIntroToast: 'Steine lassen sich nicht paaren und blockieren den Weg.',
  clearTitle: 'Feld geräumt!',
  clearBody: 'Du hast alle Zahlen entfernt.',
  gameOverTitle: 'Keine Züge mehr',
  gameOverBody: 'Das Spielfeld ist am Limit.',
  step1Title: 'Gleich oder zusammen 10',
  step1Body: 'Verbinde zwei gleiche Zahlen oder zwei, die zusammen 10 ergeben.',
  step2Title: 'Der Weg muss frei sein',
  step2Body:
    'Waagerecht, senkrecht, diagonal — oder vom Zeilenende zum Anfang der nächsten Zeile. Leere Felder stören nicht, eine verbliebene Zahl blockiert den Weg.',
  step3Title: 'Leere das Feld',
  step3Body:
    'Steckst du fest? Mit Nachlegen kommen die restlichen Zahlen dazu. Rückgängig und Tipps sind immer gratis.',
  gameOverCount: 'Verlorene Spiele',
};
