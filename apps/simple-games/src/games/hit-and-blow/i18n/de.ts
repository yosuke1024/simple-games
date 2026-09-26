import type { HitAndBlowMessages } from './en';

export const de: HitAndBlowMessages = {
  hitAndBlowName: 'Hit & Blow',
  hitAndBlowChooseDifficulty: 'Schwierigkeit wählen',
  hitAndBlowDifficulty_easy: 'Leicht',
  hitAndBlowDifficulty_normal: 'Normal',
  hitAndBlowDifficulty_hard: 'Schwer',
  hitAndBlowCodeNote: '{slots} von {pool} Symbolen',
  hitAndBlowBestNote: 'Bestwert {count}',
  hitAndBlowConfirmSwitchTitle: 'Laufendes Spiel ersetzen?',
  hitAndBlowConfirmSwitchBody: 'Dein Spiel {current} wird durch ein neues Spiel {next} ersetzt.',

  hitAndBlowSymbol_circle: 'Kreis',
  hitAndBlowSymbol_triangle: 'Dreieck',
  hitAndBlowSymbol_square: 'Quadrat',
  hitAndBlowSymbol_diamond: 'Raute',
  hitAndBlowSymbol_star: 'Stern',
  hitAndBlowSymbol_cross: 'Kreuz',
  hitAndBlowSymbol_hexagon: 'Sechseck',
  hitAndBlowSymbol_heart: 'Herz',

  hitAndBlowGuessCounter: 'Versuch {n}',
  hitAndBlowHistoryLabel: 'Bisherige Versuche',
  hitAndBlowHistoryEmpty: 'Deine Versuche erscheinen hier.',
  hitAndBlowRowLabel: 'Versuch {n}: {symbols}. Treffer {hits}, Enthalten {blows}.',
  hitAndBlowDraftLabel: 'Dein Versuch',
  hitAndBlowSlotEmpty: 'Feld {n}: leer',
  hitAndBlowSlotFilled: 'Feld {n}: {symbol}',
  hitAndBlowPaletteLabel: 'Symbole',
  hitAndBlowCheck: 'Prüfen',
  hitAndBlowHit: 'Treffer',
  hitAndBlowBlow: 'Enthalten',

  hitAndBlowWinTitle: 'Code geknackt',
  hitAndBlowWinBody: 'Du hast die verborgene Reihe gefunden.',
  hitAndBlowGuessesLabel: 'Versuche',
  hitAndBlowNewBest: 'Deine bisher wenigsten Versuche.',
  hitAndBlowSolved: 'Gelöst',
  hitAndBlowFewestGuesses: 'Wenigste Versuche',
  hitAndBlowAverageGuesses: 'Durchschnittliche Versuche',

  hitAndBlowStep1Title: 'Die verborgene Reihe finden',
  hitAndBlowStep1Body:
    'Eine Reihe verschiedener Symbole ist verborgen. Finde heraus, welche und in welcher Reihenfolge.',
  hitAndBlowStep2Title: 'Einen Versuch zusammenstellen',
  hitAndBlowStep2Body: 'Tippe auf Symbole, um die Reihe zu füllen, und drücke dann auf Prüfen.',
  hitAndBlowStep3Title: 'Die Markierungen lesen',
  hitAndBlowStep3Body:
    '● Treffer: Symbol und Platz stimmen. ○ Enthalten: Symbol stimmt, Platz nicht. Du kannst so oft raten, wie du willst.',
};
