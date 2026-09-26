import type { HitAndBlowMessages } from './en';

export const fr: HitAndBlowMessages = {
  hitAndBlowName: 'Hit & Blow',
  hitAndBlowChooseDifficulty: 'Choisissez une difficulté',
  hitAndBlowDifficulty_easy: 'Facile',
  hitAndBlowDifficulty_normal: 'Normal',
  hitAndBlowDifficulty_hard: 'Difficile',
  hitAndBlowCodeNote: '{slots} sur {pool} symboles',
  hitAndBlowBestNote: 'Record {count}',
  hitAndBlowConfirmSwitchTitle: 'Remplacer la partie en cours ?',
  hitAndBlowConfirmSwitchBody:
    'Votre partie {current} sera remplacée par une nouvelle partie {next}.',

  hitAndBlowSymbol_circle: 'Cercle',
  hitAndBlowSymbol_triangle: 'Triangle',
  hitAndBlowSymbol_square: 'Carré',
  hitAndBlowSymbol_diamond: 'Losange',
  hitAndBlowSymbol_star: 'Étoile',
  hitAndBlowSymbol_cross: 'Croix',
  hitAndBlowSymbol_hexagon: 'Hexagone',
  hitAndBlowSymbol_heart: 'Cœur',

  hitAndBlowGuessCounter: 'Essai {n}',
  hitAndBlowHistoryLabel: 'Essais précédents',
  hitAndBlowHistoryEmpty: 'Vos essais apparaîtront ici.',
  hitAndBlowRowLabel: 'Essai {n} : {symbols}. Correct {hits}, Présent {blows}.',
  hitAndBlowDraftLabel: 'Votre essai',
  hitAndBlowSlotEmpty: 'Case {n} : vide',
  hitAndBlowSlotFilled: 'Case {n} : {symbol}',
  hitAndBlowPaletteLabel: 'Symboles',
  hitAndBlowCheck: 'Vérifier',
  hitAndBlowHit: 'Correct',
  hitAndBlowBlow: 'Présent',

  hitAndBlowWinTitle: 'Code déchiffré',
  hitAndBlowWinBody: 'Vous avez trouvé la ligne cachée.',
  hitAndBlowGuessesLabel: 'Essais',
  hitAndBlowNewBest: "Votre meilleur nombre d'essais.",
  hitAndBlowSolved: 'Résolu',
  hitAndBlowFewestGuesses: "Moins d'essais",
  hitAndBlowAverageGuesses: 'Essais moyens',

  hitAndBlowStep1Title: 'Trouver la ligne cachée',
  hitAndBlowStep1Body:
    'Une ligne de symboles différents est cachée. Découvrez lesquels, et dans quel ordre.',
  hitAndBlowStep2Title: 'Composer un essai',
  hitAndBlowStep2Body: 'Touchez des symboles pour remplir la ligne, puis appuyez sur Vérifier.',
  hitAndBlowStep3Title: 'Lire les marques',
  hitAndBlowStep3Body:
    '● Correct : bon symbole, bonne place. ○ Présent : bon symbole, mauvaise place. Essayez autant de fois que vous voulez.',
};
