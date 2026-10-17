/**
 * Peg Solitaire — the French catalog. Provenance
 * (docs/PEG_SOLITAIRE_RULES.md §15): `machine` — written by an AI from the
 * English source; no native speaker has read it. The title
 * (`pegSolitaireName`) is a proper noun and stays as-is. The boards keep the
 * word "plateau" ("Plateau anglais", the usual name of the 33-hole board), so
 * the button does not read as the name of a language; the confirm line puts
 * the names in brackets so no article has to agree with them.
 */
import type { PegSolitaireMessages } from './en';

export const fr: PegSolitaireMessages = {
  pegSolitaireName: 'Peg Solitaire',

  pegSolitaireBoard_english: 'Plateau anglais',
  pegSolitaireBoard_triangle: 'Plateau triangulaire',
  pegSolitaireBoardLabel_english: 'Plateau anglais, 33 trous',
  pegSolitaireBoardLabel_triangle: 'Plateau triangulaire, 15 trous',
  pegSolitaireHoleCount: '{count} trous',

  pegSolitaireChooseBoard: 'Choisissez un plateau',
  pegSolitaireBestNote: 'Moins de pions : {count}',
  pegSolitaireConfirmSwitchTitle: 'Remplacer la partie en cours ?',
  pegSolitaireConfirmSwitchBody:
    'Votre partie en cours ({current}) sera remplacée par une nouvelle partie ({next}).',

  pegSolitaireHoleGrid: 'Ligne {row}, colonne {col} : {content}',
  pegSolitaireHoleRow: 'Ligne {row}, trou {place} : {content}',
  pegSolitaireContentPeg: 'pion',
  pegSolitaireContentPegRing: 'pion dans le trou cerclé',
  pegSolitaireContentEmpty: 'vide',
  pegSolitaireContentEmptyRing: 'trou cerclé, vide',
  pegSolitaireContentLanding: 'vide, un saut peut atterrir ici',
  pegSolitaireContentLandingRing: 'trou cerclé, vide, un saut peut atterrir ici',

  pegSolitairePegsLeft: 'Pions restants : {count}',
  pegSolitaireNoJump: 'Ce pion ne peut pas encore sauter.',

  pegSolitairePerfectTitle: 'Réussite parfaite !',
  pegSolitairePerfectBody: 'Le dernier pion est dans le trou cerclé.',
  pegSolitaireSingleTitle: 'Il reste un pion',
  pegSolitaireSingleBody: 'Le dernier pion est hors du trou cerclé.',
  pegSolitaireStuckTitle: 'Plus aucun saut',
  pegSolitaireStuckBody: 'Aucun pion ne peut plus sauter.',
  pegSolitairePegsLeftLabel: 'Pions restants',
  pegSolitaireFewestLabel: 'Minimum sur ce plateau',
  pegSolitaireNewFewest: 'Jamais si peu sur ce plateau.',
  pegSolitaireBoardFact: 'Plateau',
  pegSolitaireNewBoard: 'Nouveau plateau',

  pegSolitaireStatFewest: 'Moins de pions restants',
  pegSolitaireStatPerfect: 'Réussites parfaites',

  pegSolitaireStep1Title: 'Sauter et retirer',
  pegSolitaireStep1Body:
    'Faites sauter un pion par-dessus son voisin vers un trou vide — le pion sauté est retiré.',
  pegSolitaireStep2Title: 'En ligne droite seulement',
  pegSolitaireStep2Body:
    'On saute en ligne droite : en haut, en bas et sur les côtés sur le plateau anglais, le long des trois lignes sur le triangulaire.',
  pegSolitaireStep3Title: 'Garder le dernier',
  pegSolitaireStep3Body:
    'Quand aucun pion ne peut sauter, la partie s’arrête — laissez le dernier dans le trou cerclé pour une réussite parfaite.',
};
