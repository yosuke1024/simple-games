import type { DominoesMessages } from './en';

export const fr: DominoesMessages = {
  dominoesName: 'Dominoes',
  dominoesRecordNote: '{wins} victoires · {losses} défaites',

  dominoesTileLabel: 'Domino {a}–{b}',
  dominoesLineLabel:
    'Ligne de jeu : {count} dominos, extrémité gauche {left}, extrémité droite {right}',
  dominoesHandLabel: 'Vos dominos',
  dominoesPlayLeft: 'Jouer à l’extrémité gauche ({value})',
  dominoesPlayRight: 'Jouer à l’extrémité droite ({value})',
  dominoesCpuShort: 'CPU',
  dominoesBoneyardShort: 'Pioche',
  dominoesCpuTiles: 'Le CPU a {count} dominos',
  dominoesBoneyardTiles: 'Pioche : {count} dominos',
  dominoesDraw: 'Piocher',
  dominoesPass: 'Passer',

  dominoesYourTurn: 'À vous de jouer',
  dominoesCpuTurn: 'Le CPU réfléchit…',
  dominoesCpuDrew: 'Le CPU a pioché un domino',
  dominoesCpuPassed: 'Le CPU a passé son tour. À vous de jouer',
  dominoesMustDraw: 'Aucun domino ne convient. Piochez',
  dominoesNoTileFits: 'Aucun domino ne convient et la pioche est vide. Passez',
  dominoesChooseEnd: 'Choisissez une extrémité pour ce domino',
  dominoesOpenedYou: 'Vous avez ouvert avec {tile}',
  dominoesOpenedCpu: 'Le CPU a ouvert avec {tile}. À vous de jouer',

  dominoesWinTitle: 'Vous avez gagné !',
  dominoesWinBodyOut: 'Vous avez posé votre dernier domino.',
  dominoesWinBodyBlocked: 'Personne ne pouvait plus jouer, et vous aviez moins de points.',
  dominoesLoseTitle: 'Le CPU gagne',
  dominoesLoseBodyOut: 'Le CPU a posé son dernier domino.',
  dominoesLoseBodyBlocked: 'Personne ne pouvait plus jouer, et le CPU avait moins de points.',
  dominoesDrawTitle: 'Égalité',
  dominoesDrawBody: 'Personne ne pouvait plus jouer, et les points étaient à égalité.',
  dominoesScoreYou: 'Vous marquez {points} points',
  dominoesScoreCpu: 'Le CPU marque {points} points',
  dominoesPipsLeft: 'Points restants : vous {you}, CPU {cpu}',

  dominoesWins: 'Victoires',
  dominoesLosses: 'Défaites',
  dominoesDraws: 'Égalités',

  dominoesStep1Title: 'Faites correspondre une extrémité',
  dominoesStep1Body:
    'Jouez un domino dont le nombre correspond à l’une des extrémités ouvertes de la ligne.',
  dominoesStep2Title: 'Bloqué ? Piochez',
  dominoesStep2Body:
    'Si aucun domino ne convient, piochez jusqu’à en trouver un. Passez seulement quand la pioche est vide.',
  dominoesStep3Title: 'Terminez le premier',
  dominoesStep3Body:
    'Posez votre dernier domino pour gagner. Les points restant dans l’autre main sont votre score.',
};
