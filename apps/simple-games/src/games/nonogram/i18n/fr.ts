import type { NonogramMessages } from './en';

export const fr: NonogramMessages = {
  nonoName: 'Nonogramme',
  nonoBoardLabel: 'Grille de nonogramme, {size} par {size}',
  nonoCellBlank: 'Vide, ligne {row}, colonne {col}',
  nonoCellFilled: 'Peinte, ligne {row}, colonne {col}',
  nonoCellCrossed: 'Croix, ligne {row}, colonne {col}',
  nonoRowClueLabel: 'Ligne {n} : {clue}',
  nonoColClueLabel: 'Colonne {n} : {clue}',
  nonoSizeLabel: '{n}×{n}',
  nonoXMode: 'Mode X',
  nonoXModeNote: 'Un appui pose une croix ; un appui long peint.',
  nonoHintFound: 'La ligne surlignée détermine une case.',
  nonoHintBroken: 'La ligne surlignée ne correspond plus à son indice.',
  nonoHintNone: 'Aucun coup sûr pour le moment.',
  nonoSolvedTitle: 'Résolu !',
  nonoSolvedBody: 'Tous les indices sont respectés.',
  nonoHintsUsed: 'Indices utilisés',
  nonoNewBestTime: 'Votre meilleur temps.',
  nonoLevelsSolved: 'Niveaux résolus',
  nonoDailiesSolved: 'Défis quotidiens résolus',
  nonoDailyBacklogHint: 'Les jours précédents restent ouverts.',
  nonoStep1Title: 'Les nombres sont des blocs',
  nonoStep1Body:
    'Chaque nombre est un bloc de cases peintes, dans l’ordre, avec au moins un espace entre les blocs.',
  nonoStep2Title: 'Éliminez avec une croix',
  nonoStep2Body: 'Marquez d’une croix les cases qui restent vides pour cerner la ligne.',
  nonoStep3Title: 'Respectez chaque ligne',
  nonoStep3Body:
    'Quand toutes les lignes et colonnes concordent, la grille est finie. Deviner n’est jamais nécessaire.',
};
