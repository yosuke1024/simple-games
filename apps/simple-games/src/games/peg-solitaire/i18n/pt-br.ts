/**
 * Peg Solitaire — the Brazilian Portuguese catalog. Provenance
 * (docs/PEG_SOLITAIRE_RULES.md §15): `machine` — written by an AI from the
 * English source; no native speaker has read it. The title
 * (`pegSolitaireName`) is a proper noun and stays as-is. The boards keep the
 * word "tabuleiro" ("Tabuleiro inglês"), so the button does not read as the
 * name of a language; the confirm line puts the names in brackets so no
 * article has to agree with them.
 */
import type { PegSolitaireMessages } from './en';

export const ptBR: PegSolitaireMessages = {
  pegSolitaireName: 'Peg Solitaire',

  pegSolitaireBoard_english: 'Tabuleiro inglês',
  pegSolitaireBoard_triangle: 'Tabuleiro triangular',
  pegSolitaireBoardLabel_english: 'Tabuleiro inglês, 33 furos',
  pegSolitaireBoardLabel_triangle: 'Tabuleiro triangular, 15 furos',
  pegSolitaireHoleCount: '{count} furos',

  pegSolitaireChooseBoard: 'Escolha um tabuleiro',
  pegSolitaireBestNote: 'Menos pinos: {count}',
  pegSolitaireConfirmSwitchTitle: 'Substituir o jogo em andamento?',
  pegSolitaireConfirmSwitchBody:
    'Seu jogo em andamento ({current}) será substituído por um jogo novo ({next}).',

  pegSolitaireHoleGrid: 'Linha {row}, coluna {col}: {content}',
  pegSolitaireHoleRow: 'Linha {row}, furo {place}: {content}',
  pegSolitaireContentPeg: 'pino',
  pegSolitaireContentPegRing: 'pino no furo com anel',
  pegSolitaireContentEmpty: 'vazio',
  pegSolitaireContentEmptyRing: 'furo com anel, vazio',
  pegSolitaireContentLanding: 'vazio, um pulo pode terminar aqui',
  pegSolitaireContentLandingRing: 'furo com anel, vazio, um pulo pode terminar aqui',

  pegSolitairePegsLeft: 'Pinos restantes: {count}',
  pegSolitaireNoJump: 'Este pino não pode pular agora.',

  pegSolitairePerfectTitle: 'Final perfeito!',
  pegSolitairePerfectBody: 'O último pino ficou no furo com anel.',
  pegSolitaireSingleTitle: 'Resta um pino',
  pegSolitaireSingleBody: 'O último pino está fora do furo com anel.',
  pegSolitaireStuckTitle: 'Sem pulos possíveis',
  pegSolitaireStuckBody: 'Nenhum pino pode pular outro.',
  pegSolitairePegsLeftLabel: 'Pinos restantes',
  pegSolitaireFewestLabel: 'Mínimo neste tabuleiro',
  pegSolitaireNewFewest: 'Nunca tão poucos neste tabuleiro.',
  pegSolitaireBoardFact: 'Tabuleiro',
  pegSolitaireNewBoard: 'Novo tabuleiro',

  pegSolitaireStatFewest: 'Menos pinos restantes',
  pegSolitaireStatPerfect: 'Finais perfeitos',

  pegSolitaireStep1Title: 'Pule e retire',
  pegSolitaireStep1Body:
    'Pule com um pino por cima do vizinho até um furo vazio: o pino pulado é retirado.',
  pegSolitaireStep2Title: 'Só em linha reta',
  pegSolitaireStep2Body:
    'Os pulos são em linha reta: para cima, para baixo e para os lados no inglês, pelas três linhas no triangular.',
  pegSolitaireStep3Title: 'Deixe o último',
  pegSolitaireStep3Body:
    'Quando nenhum pino puder pular, o jogo acaba: deixe o último no furo com anel para um final perfeito.',
};
