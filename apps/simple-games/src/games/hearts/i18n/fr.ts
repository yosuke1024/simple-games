import type { HeartsMessages } from './en';

export const fr: HeartsMessages = {
  heartsName: 'Hearts',

  heartsChooseOpponent: 'Choisissez vos adversaires',
  heartsDifficulty_easy: 'Facile',
  heartsDifficulty_normal: 'Normal',
  heartsDifficulty_hard: 'Difficile',
  heartsRecordNote: '{wins} victoires · {losses} défaites · {draws} égalités',
  heartsConfirmSwitchTitle: 'Remplacer la partie en cours ?',
  heartsConfirmSwitchBody: 'Votre partie {current} sera remplacée par une nouvelle partie {next}.',

  heartsTableLabel: 'Table de Hearts',
  heartsHandLabel: 'Votre main',
  heartsTrickLabel: 'Le pli',
  heartsTrayLabel: 'Cartes que vous passez',
  heartsYou: 'Vous',
  heartsCpuSeat: 'CPU {n}',
  heartsYouLabel: 'Vous : {hand} points dans cette donne, {total} dans la partie',
  heartsSeatLabel:
    'CPU {n} : {cards} cartes, {hand} points dans cette donne, {total} dans la partie',
  heartsTookLastTrick: 'A pris le dernier pli',
  heartsCardLabel: '{rank} de {suit}',
  heartsSuit_spades: 'pique',
  heartsSuit_hearts: 'cœur',
  heartsSuit_diamonds: 'carreau',
  heartsSuit_clubs: 'trèfle',
  heartsCardBlocked: '{card}, injouable pour le moment',
  heartsCardChosen: '{card}, choisie pour le passage',
  heartsTrickCard: '{card}, {seat}',

  heartsPassPrompt: 'Choisissez trois cartes à passer',
  heartsPassLeft: 'Passage à gauche',
  heartsPassAcross: 'Passage en face',
  heartsPassRight: 'Passage à droite',
  heartsPassConfirm: 'Passer ces trois cartes',
  heartsPassWaiting: 'En attente des autres joueurs…',

  heartsPlayPrompt: 'Touchez une carte, puis touchez-la à nouveau pour la jouer',
  heartsCpuTurn: 'Le CPU {n} joue…',
  heartsTrickYou: 'Vous prenez le pli',
  heartsTrickCpu: 'Le CPU {n} prend le pli',

  heartsHandTitle: 'Donne comptée',
  heartsMoonTitle: 'Lune réussie',
  heartsMoonYou:
    'Vous avez pris les vingt-six points, alors les trois autres joueurs prennent 26 chacun.',
  heartsMoonCpu: 'Le CPU {n} a pris les vingt-six points, alors tous les autres prennent 26.',
  heartsThisHand: 'Cette donne',
  heartsMatchTotal: 'Partie',
  heartsNextHand: 'Donne suivante',

  heartsWinTitle: 'Vous avez gagné !',
  heartsWinBody: 'Le moins de points au moment où quelqu’un a dépassé cent.',
  heartsLoseTitle: 'Le CPU gagne',
  heartsLoseBody: 'Un autre joueur a fini avec moins de points. La prochaine partie est gratuite.',
  heartsDrawTitle: 'Égalité',
  heartsDrawBody: 'Vous finissez à égalité avec un autre joueur au score le plus bas.',
  heartsFinalScores: 'Scores finaux',

  heartsWins: 'Victoires',
  heartsLosses: 'Défaites',
  heartsDraws: 'Égalités',

  heartsStep1Title: 'Passez trois cartes',
  heartsStep1Body:
    'Avant presque chaque donne, vous choisissez trois cartes et vous les passez — à gauche, puis à droite, puis en face, puis une donne où personne ne passe rien.',
  heartsStep2Title: 'Fournissez la couleur',
  heartsStep2Body:
    'Celui qui entame fixe la couleur et il faut la fournir tant qu’on en a ; la plus forte carte de cette couleur emporte le pli.',
  heartsStep3Title: 'Le moins de points gagne',
  heartsStep3Body:
    'Chaque cœur ramassé coûte un point et la Q de pique en coûte treize, donc quand quelqu’un dépasse cent, c’est le moins de points qui gagne.',
};
