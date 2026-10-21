/**
 * Brazilian Portuguese catalog for Scopa.
 *
 * Provenance (docs/SCOPA_RULES.md §12, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI from the English source on 2026-10-21. **No native speaker
 * has read it**, and it is not to be treated as reviewed.
 * The title (`scopaName`) stays “Scopa” in every locale. Terms follow the
 * glossary in §12 (the point / primiera / 7♦ / the ♦ category / cards /
 * take / place / dealer / deal / match):
 * scopa / primiera / 7♦ / ouros / cartas / pegar / colocar / quem dá as cartas / mão / partida.
 * Counts stay out of plural forms, as in `en` (“name: number”).
 * The point is never called “escova”, and nothing here says “varrer”: a
 * reader who knows the sum-of-fifteen game must not read these rules as it.
 */
import type { ScopaMessages } from './en';

export const ptBR: ScopaMessages = {
  scopaName: 'Scopa',

  scopaStep1Title: 'Pegar',
  scopaStep1Body:
    'Jogue uma carta: pegue uma carta da mesa de mesmo valor ou, se não houver, cartas que somem esse valor.',
  scopaStep2Title: 'Colocar ou limpar a mesa',
  scopaStep2Body:
    'Uma carta que não pega nada é colocada na mesa, e pegar todas as cartas da mesa vale um ponto: uma scopa.',
  scopaStep3Title: 'Onze para vencer',
  scopaStep3Body:
    'Cada mão dá um ponto para mais cartas, mais ouros, o 7♦ e a primiera, e vence quem tiver 11 ou mais e estiver na frente.',

  scopaYou: 'Você',
  scopaCpu: 'CPU',
  scopaSuit_spades: 'espadas',
  scopaSuit_hearts: 'copas',
  scopaSuit_diamonds: 'ouros',
  scopaSuit_clubs: 'paus',
  scopaCardLabel: '{face} de {suit}',

  scopaTableLabel: 'Mesa',
  scopaHandLabel: 'Sua mão',
  scopaHandCanTake: '{card}, pode pegar',
  scopaHandCannotTake: '{card}, não pode pegar agora',
  scopaTableCanTake: '{card}, pode ser pega',
  scopaTableInGroup: '{card}, no seu grupo',
  scopaPlaceHere: 'Colocar aqui',
  scopaStockLabel: 'Cartas no monte: {n}',

  scopaCpuHandLabel: 'Cartas na mão da CPU: {n}',
  scopaBandLabel:
    '{who}: placar {score}; nesta mão: cartas {cards}, ouros {diamonds}, scopas {scopas}{settebello}{dealer}',
  scopaBandSettebello: ', tem o 7♦',
  scopaBandDealer: ', quem dá as cartas',
  scopaPrimieraLabel: 'Sua primiera: {total}',
  scopaPrimieraSuit: '{suit}: {card}, {value}',
  scopaPrimieraMissing: '{suit}: nenhuma ainda',

  scopaLineYourTurn: 'Sua vez: jogue uma carta',
  scopaLineCpuTurn: 'Vez da CPU',
  scopaLineDealing: 'Dando três cartas para cada um',
  scopaLinePlace: 'Ela não pega nada: coloque-a na mesa ou escolha outra carta',
  scopaLineTakeOne: 'Toque de novo para pegar',
  scopaLineChooseSame: 'Escolha qual carta pegar',
  scopaLineBuildSum: 'Escolha cartas que somem {n} (até agora {sum})',
  scopaLineCpuTook: 'A CPU pegou',
  scopaLineCpuPlaced: 'A CPU colocou',
  scopaLineScopaYou: 'Scopa: você limpou a mesa',
  scopaLineScopaCpu: 'Scopa: a CPU limpou a mesa',
  scopaLineSweepYou: 'Últimas cartas da mesa: para você',
  scopaLineSweepCpu: 'Últimas cartas da mesa: para a CPU',
  scopaSayCpuTook: 'A CPU jogou {card} e pegou {cards}',
  scopaSayCpuPlaced: 'A CPU colocou {card}',
  scopaSaySweepYou: 'Você pega as cartas que sobraram na mesa: {cards}',
  scopaSaySweepCpu: 'A CPU pega as cartas que sobraram na mesa: {cards}',

  scopaSayThen: '{first}. {then}',

  scopaDealTitle: 'Mão {n}',
  scopaColCategory: 'Categoria',
  scopaColPoint: 'Ponto',
  scopaCatCards: 'Cartas',
  scopaCatDiamonds: 'Ouros',
  scopaCatPrimiera: 'Primiera',
  scopaCatScopa: 'Scopa',
  scopaPrimieraShort: '{total} ({suits} de 4 naipes)',
  scopaDealPoints: 'Nesta mão',
  scopaSweepYou: 'Cartas que sobraram na mesa, pegas por você: {n}',
  scopaSweepCpu: 'Cartas que sobraram na mesa, pegas pela CPU: {n}',
  scopaNextDeal: 'Próxima mão',

  scopaWinTitle: 'Você venceu a partida',
  scopaLoseTitle: 'A CPU venceu a partida',
  scopaDecidingDeal: 'A última mão',

  scopaRecordNote: 'Vencidas {wins} · Perdidas {losses}',
  scopaWins: 'Vitórias',
  scopaLosses: 'Derrotas',
};
