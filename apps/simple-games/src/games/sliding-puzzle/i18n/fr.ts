import type { SlidingPuzzleMessages } from './en';

export const fr: SlidingPuzzleMessages = {
  slideName: 'Taquin',
  slideBoardLabel: 'Plateau du taquin',
  slideTileLabel: '{value}, ligne {row}, colonne {col}',
  slideBlankLabel: 'Vide, ligne {row}, colonne {col}',
  slideSizeLabel: '{n}x{n}',
  slideMoves: 'Coups',
  slideBestMoves: 'Moins de coups',
  slideSolvedTitle: 'Résolu !',
  slideSolvedBody: 'Tous les nombres sont de nouveau en ordre.',
  slideNewBestMoves: 'Moins de coups que jamais.',
  slideNewBestTime: 'Votre meilleur temps.',
  slideLevelsSolved: 'Niveaux résolus',
  slideDailiesSolved: 'Défis résolus',
  slideDailyBacklogHint: 'Les jours précédents restent toujours accessibles.',
  slideStep1Title: 'Touchez près du vide',
  slideStep1Body: 'Touchez une tuile voisine de la case vide et elle glisse dedans.',
  slideStep2Title: 'Toute une ligne bouge',
  slideStep2Body:
    'Sur la même ligne ou colonne, toutes les tuiles intermédiaires glissent ensemble.',
  slideStep3Title: 'Rangez à partir de 1',
  slideStep3Body: "Alignez les nombres dans l'ordre de lecture, le vide en bas à droite.",
};
