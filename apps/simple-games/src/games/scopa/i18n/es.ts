/**
 * Spanish catalog for Scopa.
 *
 * Provenance (docs/SCOPA_RULES.md §12, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI from the English source on 2026-10-21. **No native speaker
 * has read it**, and it is not to be treated as reviewed.
 * The title (`scopaName`) stays “Scopa” in every locale. Terms follow the
 * glossary in §12 (the point / primiera / 7♦ / the ♦ category / cards /
 * take / place / dealer / deal / match):
 * scopa / primiera / 7♦ / diamantes / cartas / tomar / poner / repartidor / mano / partida.
 * Counts stay out of plural forms, as in `en` (“name: number”).
 * The point is never called “escoba”, and nothing here says “barrer”: a
 * reader who knows the sum-of-fifteen game must not read these rules as it.
 */
import type { ScopaMessages } from './en';

export const es: ScopaMessages = {
  scopaName: 'Scopa',

  scopaStep1Title: 'Tomar',
  scopaStep1Body:
    'Juega una carta: toma una carta de la mesa del mismo valor o, si no hay ninguna, cartas que sumen ese valor.',
  scopaStep2Title: 'Poner o vaciar la mesa',
  scopaStep2Body:
    'Una carta que no toma nada se pone en la mesa, y tomar todas las cartas de la mesa da un punto: una scopa.',
  scopaStep3Title: 'Once para ganar',
  scopaStep3Body:
    'Cada mano da un punto por más cartas, más diamantes, el 7♦ y la primiera, y gana quien tenga 11 o más y vaya por delante.',

  scopaYou: 'Tú',
  scopaCpu: 'CPU',
  scopaSuit_spades: 'picas',
  scopaSuit_hearts: 'corazones',
  scopaSuit_diamonds: 'diamantes',
  scopaSuit_clubs: 'tréboles',
  scopaCardLabel: '{face} de {suit}',

  scopaTableLabel: 'Mesa',
  scopaHandLabel: 'Tu mano',
  scopaHandCanTake: '{card}, puede tomar',
  scopaHandCannotTake: '{card}, ahora no puede tomar',
  scopaTableCanTake: '{card}, se puede tomar',
  scopaTableInGroup: '{card}, en tu grupo',
  scopaPlaceHere: 'Poner aquí',
  scopaStockLabel: 'Cartas en el mazo: {n}',

  scopaCpuHandLabel: 'Cartas en la mano de la CPU: {n}',
  scopaBandLabel:
    '{who}: puntuación {score}; esta mano: cartas {cards}, diamantes {diamonds}, scopas {scopas}{settebello}{dealer}',
  scopaBandSettebello: ', tiene el 7♦',
  scopaBandDealer: ', repartidor',
  scopaPrimieraLabel: 'Tu primiera: {total}',
  scopaPrimieraSuit: '{suit}: {card}, {value}',
  scopaPrimieraMissing: '{suit}: aún ninguna',

  scopaLineYourTurn: 'Tu turno: juega una carta',
  scopaLineCpuTurn: 'Turno de la CPU',
  scopaLineDealing: 'Repartiendo tres cartas a cada uno',
  scopaLinePlace: 'No toma nada: ponla en la mesa o elige otra carta',
  scopaLineTakeOne: 'Toca otra vez para tomar',
  scopaLineChooseSame: 'Elige qué carta tomar',
  scopaLineBuildSum: 'Elige cartas que sumen {n} (llevas {sum})',
  scopaLineCpuTook: 'La CPU toma',
  scopaLineCpuPlaced: 'La CPU pone',
  scopaLineScopaYou: 'Scopa: has vaciado la mesa',
  scopaLineScopaCpu: 'Scopa: la CPU ha vaciado la mesa',
  scopaLineSweepYou: 'Últimas cartas de la mesa: para ti',
  scopaLineSweepCpu: 'Últimas cartas de la mesa: para la CPU',
  scopaSayCpuTook: 'La CPU ha jugado {card} y ha tomado {cards}',
  scopaSayCpuPlaced: 'La CPU ha puesto {card}',
  scopaSaySweepYou: 'Tomas las cartas que quedan en la mesa: {cards}',
  scopaSaySweepCpu: 'La CPU toma las cartas que quedan en la mesa: {cards}',

  scopaSayThen: '{first}. {then}',

  scopaDealTitle: 'Mano {n}',
  scopaColCategory: 'Categoría',
  scopaColPoint: 'Punto',
  scopaCatCards: 'Cartas',
  scopaCatDiamonds: 'Diamantes',
  scopaCatPrimiera: 'Primiera',
  scopaCatScopa: 'Scopa',
  scopaPrimieraShort: '{total} ({suits} de 4 palos)',
  scopaDealPoints: 'Esta mano',
  scopaSweepYou: 'Cartas que quedaban en la mesa, tomadas por ti: {n}',
  scopaSweepCpu: 'Cartas que quedaban en la mesa, tomadas por la CPU: {n}',
  scopaNextDeal: 'Siguiente mano',

  scopaWinTitle: 'Has ganado la partida',
  scopaLoseTitle: 'La CPU ha ganado la partida',
  scopaDecidingDeal: 'La última mano',

  scopaRecordNote: 'Ganadas {wins} · Perdidas {losses}',
  scopaWins: 'Victorias',
  scopaLosses: 'Derrotas',
};
