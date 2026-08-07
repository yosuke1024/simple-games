import type { FreeCellMessages } from './en';

export const fr: FreeCellMessages = {
  freecellName: 'FreeCell',
  fcNewDeal: 'Nouvelle donne',
  fcTableLabel: 'Table de FreeCell',
  fcCardLabel: '{rank} de {suit}',
  fcSuit_spades: 'pique',
  fcSuit_hearts: 'cœur',
  fcSuit_diamonds: 'carreau',
  fcSuit_clubs: 'trèfle',
  fcCellLabel: 'Cellule libre {n}, {card}',
  fcCellEmpty: 'Cellule libre {n}, vide',
  fcCellsLabel: 'Cellules libres',
  fcFoundationCard: 'Fondation, {card}',
  fcFoundationEmpty: 'Fondation, {suit}, vide',
  fcColumnLabel: 'Colonne {n}',
  fcColumnEmpty: "Colonne {n}, vide — n'importe quelle carte peut venir ici",
  fcAutoFinish: 'Terminer la partie',
  fcStuckTitle: 'Plus aucun coup',
  fcStuckBody:
    'Toutes les cellules sont pleines et rien ne passe. Annulez un coup, ou prenez une nouvelle donne.',
  fcWonTitle: 'Gagné !',
  fcWonBody: 'Les quatre familles sont complètes.',
  fcNewBestMoves: 'Votre plus petit nombre de coups.',
  fcNewBestTime: 'Votre meilleur temps.',
  fcBestMoves: 'Minimum de coups',
  fcDealsPlayed: 'Donnes jouées',
  fcGamesWon: 'Parties gagnées',
  fcWinRate: 'Taux de victoire',
  fcDailiesWon: 'Défis quotidiens gagnés',
  fcDailyBacklogHint: 'Les jours précédents restent ouverts. Prenez votre temps.',
  fcStep1Title: 'Un de moins, couleurs alternées',
  fcStep1Body:
    'Empilez en descendant, rouge sur noir sur rouge. Touchez une carte, puis sa destination.',
  fcStep2Title: 'Quatre cellules, une carte chacune',
  fcStep2Body:
    'Garez une carte dans une cellule libre pour creuser dessous. Plus il reste de cellules vides, plus vous déplacez de cartes à la fois.',
  fcStep3Title: "De l'as au roi",
  fcStep3Body:
    "Montez chaque famille à sa fondation, de l'as au roi. Les quatre complètes, c'est gagné.",
};
