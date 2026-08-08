import type { GinRummyMessages } from './en';

export const fr: GinRummyMessages = {
  ginName: 'Gin Rummy',

  ginChooseOpponent: 'Choisissez votre adversaire',
  ginDifficulty_easy: 'Facile',
  ginDifficulty_normal: 'Normal',
  ginDifficulty_hard: 'Difficile',
  ginRecordNote: '{wins} victoires · {losses} défaites',
  ginConfirmSwitchTitle: 'Remplacer la partie en cours ?',
  ginConfirmSwitchBody: 'Votre partie {current} sera remplacée par une nouvelle partie {next}.',

  ginTableLabel: 'Table de Gin Rummy',
  ginHandLabel: 'Votre main',
  ginOpponentLabel: 'Le CPU a {n} cartes',
  ginStockLabel: 'Pioche, {n} cartes',
  ginDiscardLabel: 'Défausse, {card} au-dessus',
  ginDiscardEmpty: 'Défausse vide',
  ginCardLabel: '{rank} de {suit}',
  ginSuit_spades: 'pique',
  ginSuit_hearts: 'cœur',
  ginSuit_diamonds: 'carreau',
  ginSuit_clubs: 'trèfle',
  ginCardInMeld: '{card}, combinaison {n}',
  ginCardDeadwood: '{card}, carte morte',
  ginDeadwood: 'Cartes mortes',
  ginYou: 'Vous',
  ginCpu: 'CPU',

  ginUpcardPrompt: 'Prenez la carte retournée ou passez',
  ginDrawPrompt: 'Piochez ou prenez le dessus de la défausse',
  ginDiscardPrompt: 'Touchez une carte, puis touchez-la à nouveau pour la défausser',
  ginKnockPrompt: 'Touchez la carte pour frapper, puis touchez-la à nouveau',
  ginCpuTurn: 'Le CPU réfléchit…',
  ginCpuPassed: 'Le CPU a passé la carte retournée',
  ginCpuDrewStock: 'Le CPU a pioché une carte',
  ginCpuTookDiscard: 'Le CPU a pris {card}',
  ginCpuDiscarded: 'Le CPU a défaussé {card}',
  ginTake: 'Prendre',
  ginPass: 'Passer',
  ginKnock: 'Frapper',

  ginHandGinTitle: 'Gin',
  ginHandKnockTitle: 'Frappe',
  ginHandUndercutTitle: 'Undercut',
  ginHandDeadTitle: 'Main annulée',
  ginHandDeadBody:
    'Il reste deux cartes dans la pioche. Personne ne marque et le même donneur redistribue.',
  ginHandYouTook: 'Vous prenez {points}',
  ginHandCpuTook: 'Le CPU prend {points}',
  ginYourMelds: 'Vos combinaisons',
  ginCpuMelds: 'Combinaisons du CPU',
  ginLaidOff: 'Cartes ajoutées',
  ginNextHand: 'Main suivante',

  ginWinTitle: 'Vous avez gagné !',
  ginWinBody: 'Cent points avant le CPU.',
  ginLoseTitle: 'Le CPU gagne',
  ginLoseBody: 'Le CPU a dépassé cent le premier. La prochaine partie est gratuite.',

  ginWins: 'Victoires',
  ginLosses: 'Défaites',

  ginStep1Title: 'Piochez une carte, jetez-en une',
  ginStep1Body: 'Prenez la pioche face cachée ou le dessus de la défausse, puis jetez une carte.',
  ginStep2Title: 'Brelans et suites',
  ginStep2Body:
    'Trois cartes de même valeur ou trois qui se suivent dans la même couleur ; le reste est mort et compté pour vous.',
  ginStep3Title: 'Frappez à dix ou moins',
  ginStep3Body:
    'Dès que vos cartes mortes tombent à dix ou moins, le bouton Frapper apparaît et clôt la main.',
};
