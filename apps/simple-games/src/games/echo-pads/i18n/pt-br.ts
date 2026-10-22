/**
 * Echo Pads — the português (Brasil) catalog. Provenance (docs/ECHO_PADS_RULES.md §14):
 * `machine` — written by an AI from the English source on 2026-10-22; nobody
 * has read it, native speaker or author. The title (`echoPadsName`) stays
 * "Echo Pads".
 *
 * Terms (§14's glossary): botão (pad), sequência, comprimento, Tocar / Ouvir de novo / Parar, Ritmo: Calmo / Médio / Rápido.
 */
import type { EchoPadsMessages } from './en';

export const ptBR: EchoPadsMessages = {
  echoPadsName: 'Echo Pads',
  echoPadsTier_4: '4 botões',
  echoPadsTier_6: '6 botões',
  echoPadsLength: 'Comprimento {n}',
  echoPadsLevelDetail: '{tier} · comprimento {length}',
  echoPadsPace: 'Ritmo',
  echoPadsPace_calm: 'Calmo',
  echoPadsPace_normal: 'Médio',
  echoPadsPace_quick: 'Rápido',
  echoPadsPlay: 'Tocar',
  echoPadsListenAgain: 'Ouvir de novo',
  echoPadsStop: 'Parar',
  echoPadsRound: 'Comprimento {k} de {target}',
  echoPadsStatusIdle: 'Toque em Tocar para ouvir {k} botões.',
  echoPadsStatusPlaying: 'Tocando {k} botões…',
  echoPadsStatusYourTurn: 'Sua vez: toque os {k} botões na mesma ordem.',
  echoPadsStatusAgain: 'Toque de novo os {k} botões, a partir do primeiro.',
  echoPadsStatusReview: 'Tocando de novo os {k} botões desta rodada…',
  echoPadsMark_circle: 'Círculo',
  echoPadsMark_triangle: 'Triângulo',
  echoPadsMark_square: 'Quadrado',
  echoPadsMark_star: 'Estrela',
  echoPadsMark_diamond: 'Losango',
  echoPadsMark_cross: 'Cruz',
  echoPadsPos_topLeft: 'em cima à esquerda',
  echoPadsPos_topMiddle: 'em cima no meio',
  echoPadsPos_topRight: 'em cima à direita',
  echoPadsPos_bottomLeft: 'embaixo à esquerda',
  echoPadsPos_bottomMiddle: 'embaixo no meio',
  echoPadsPos_bottomRight: 'embaixo à direita',
  echoPadsPadLabel: '{mark}, {position}',
  echoPadsPadsLabel: 'Botões',
  echoPadsExpectedLabel: '{pad} (o botão que vinha a seguir)',
  echoPadsMissTitle: 'A partida terminou no comprimento {k}',
  echoPadsMissBody: 'O botão {index} de {k} era: {pad}.',
  echoPadsResultTitle: 'Os {n} repetidos',
  echoPadsLongest: 'Maior repetido',
  echoPadsLongestNone: 'Nenhum',
  echoPadsReplays: 'Ouvido de novo',
  echoPadsPacesHeard: 'Ritmo',
  echoPadsNewSequence: 'Nova sequência',
  echoPadsLevelCell: '{level}, {detail}',
  echoPadsLevelCellCleared: '{level}, {detail}, concluído',
  echoPadsReplaceTitle: 'Substituir a partida em andamento?',
  echoPadsReplaceBody: 'A partida de {current} será substituída por uma nova partida de {next}.',
  echoPadsStatStarted: 'Partidas iniciadas',
  echoPadsStatCleared: 'Concluídas',
  echoPadsStatMissed: 'Encerradas por um erro',
  echoPadsStatLevels: 'Níveis concluídos',
  echoPadsStatDays: 'Dias concluídos',
  echoPadsStep1Title: 'Ouça',
  echoPadsStep1Body:
    'Toque em ▶ e os botões acendem e soam um por um — memorize a ordem (até o seu primeiro toque, você pode ouvir de novo quantas vezes quiser).',
  echoPadsStep2Title: 'Repita',
  echoPadsStep2Body: 'Depois, toque os botões na mesma ordem.',
  echoPadsStep3Title: 'Cresça',
  echoPadsStep3Body: 'A cada vez que você repete, a ordem cresce em um — sem limite de tempo.',
};
