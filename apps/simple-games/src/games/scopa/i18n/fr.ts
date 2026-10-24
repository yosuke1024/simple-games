/**
 * French catalog for Scopa.
 *
 * Provenance (docs/SCOPA_RULES.md §12, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI from the English source on 2026-10-21. **No native speaker
 * has read it**, and it is not to be treated as reviewed.
 * The title (`scopaName`) stays “Scopa” in every locale. Terms follow the
 * glossary in §12 (the point / primiera / 7♦ / the ♦ category / cards /
 * take / place / dealer / deal / match):
 * scopa / primiera / 7♦ / carreau / cartes / prendre / poser / donneur / donne / partie.
 * Counts stay out of plural forms, as in `en` (“name: number”).
 */
import type { ScopaMessages } from './en';

export const fr: ScopaMessages = {
  scopaName: 'Scopa',

  scopaStep1Title: 'Prendre',
  scopaStep1Body:
    'Jouez une carte : prenez une carte de la table de même valeur ou, s’il n’y en a pas, des cartes dont la somme fait cette valeur.',
  scopaStep2Title: 'Poser ou tout rafler',
  scopaStep2Body:
    'Une carte qui ne prend rien est posée sur la table, et prendre toutes les cartes de la table rapporte un point : une scopa.',
  scopaStep3Title: 'Onze pour gagner',
  scopaStep3Body:
    'Chaque donne rapporte un point pour le plus de cartes, le plus de carreaux, le 7♦ et la primiera ; on gagne avec 11 ou plus en étant devant.',

  scopaYou: 'Vous',
  scopaCpu: 'CPU',
  scopaSuit_spades: 'pique',
  scopaSuit_hearts: 'cœur',
  scopaSuit_diamonds: 'carreau',
  scopaSuit_clubs: 'trèfle',
  scopaCardLabel: '{face} de {suit}',

  scopaTableLabel: 'Table',
  scopaHandLabel: 'Votre main',
  scopaHandCanTake: '{card}, peut prendre',
  scopaHandCannotTake: '{card}, ne peut rien prendre pour le moment',
  scopaTableCanTake: '{card}, peut être prise',
  scopaTableInGroup: '{card}, dans votre groupe',
  scopaPlaceHere: 'Poser ici',
  scopaStockLabel: 'Cartes au talon : {n}',

  scopaCpuHandLabel: 'Cartes en main du CPU : {n}',
  scopaBandLabel:
    '{who} : score {score} ; cette donne : cartes {cards}, carreaux {diamonds}, scopas {scopas}{settebello}{dealer}',
  scopaBandSettebello: ', a le 7♦',
  scopaBandDealer: ', donneur',
  scopaPrimieraLabel: 'Votre primiera : {total}',
  scopaPrimieraSuit: '{suit} : {card}, {value}',
  scopaPrimieraMissing: '{suit} : aucune pour l’instant',

  scopaLineYourTurn: 'À vous : jouez une carte',
  scopaLineCpuTurn: 'Au CPU de jouer',
  scopaLineDealing: 'Trois cartes à chacun',
  scopaLinePlace: 'Elle ne prend rien : posez-la ou choisissez-en une autre',
  scopaLineTakeOne: 'Touchez à nouveau pour prendre',
  scopaLineChooseSame: 'Choisissez la carte à prendre',
  scopaLineBuildSum: 'Choisissez des cartes qui font {n} ({sum} pour l’instant)',
  scopaLineCpuTook: 'Le CPU prend',
  scopaLineCpuPlaced: 'Le CPU pose',
  scopaLineScopaYou: 'Scopa : vous avez vidé la table',
  scopaLineScopaCpu: 'Scopa : le CPU a vidé la table',
  scopaLineSweepYou: 'Dernières cartes de la table : pour vous',
  scopaLineSweepCpu: 'Dernières cartes de la table : pour le CPU',
  scopaSayCpuTook: 'Le CPU a joué {card} et a pris {cards}',
  scopaSayCpuPlaced: 'Le CPU a posé {card}',
  scopaSaySweepYou: 'Vous prenez les cartes restées sur la table : {cards}',
  scopaSaySweepCpu: 'Le CPU prend les cartes restées sur la table : {cards}',

  scopaSayThen: '{first}. {then}',

  scopaDealTitle: 'Donne {n}',
  scopaColCategory: 'Catégorie',
  scopaColPoint: 'Point',
  scopaCatCards: 'Cartes',
  scopaCatDiamonds: 'Carreaux',
  scopaCatPrimiera: 'Primiera',
  scopaCatScopa: 'Scopa',
  scopaPrimieraShort: '{total} ({suits} sur 4 couleurs)',
  scopaDealPoints: 'Cette donne',
  scopaSweepYou: 'Cartes restées sur la table, prises par vous : {n}',
  scopaSweepCpu: 'Cartes restées sur la table, prises par le CPU : {n}',
  scopaNextDeal: 'Donne suivante',

  scopaWinTitle: 'Vous avez gagné la partie',
  scopaLoseTitle: 'Le CPU a gagné la partie',
  scopaDecidingDeal: 'La dernière donne',

  scopaRecordNote: 'Gagnées {wins} · Perdues {losses}',
  scopaWins: 'Victoires',
  scopaLosses: 'Défaites',
};
