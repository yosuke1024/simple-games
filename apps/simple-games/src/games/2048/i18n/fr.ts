import type { Game2048Messages } from './en';

export const fr: Game2048Messages = {
  mergeName: '2048',
  mergeBoardLabel: 'Grille de 2048, 4 par 4',
  mergeCell: 'Ligne {row}, colonne {col} : {value}',
  mergeCellEmpty: 'Ligne {row}, colonne {col} : vide',
  mergeBestScore: 'Meilleur score',
  mergeBestTile: 'Plus grande tuile',
  mergeReachedCount: 'Fois où vous avez atteint 2048',
  mergeReachedTitle: 'Vous avez atteint 2048 !',
  mergeReachedBody: 'Continuez — la grille reste ouverte.',
  mergeKeepGoing: 'Continuer',
  mergeOverTitle: 'Plus aucun coup',
  mergeOverBody: 'Toutes les cases sont pleines et plus rien ne peut fusionner.',
  mergeNewBestScore: 'Votre meilleur score jusqu’ici.',
  mergeStep1Title: 'Balayez pour glisser',
  mergeStep1Body:
    'Toutes les tuiles glissent ensemble dans ce sens, et deux nombres identiques n’en font qu’un.',
  mergeStep2Title: 'Une nouvelle tuile apparaît',
  mergeStep2Body: 'Une tuile s’ajoute après chaque coup qui change la grille.',
  mergeStep3Title: 'Bloqué ? Revenez en arrière',
  mergeStep3Body:
    'Annuler est gratuit et illimité, et ne retire jamais au sort la tuile qui vient d’arriver.',
};
