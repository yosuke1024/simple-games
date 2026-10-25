/**
 * Nested Tic-Tac-Toe — the Brazilian Portuguese catalog. Provenance
 * (docs/NESTED_TIC_TAC_TOE_RULES.md §12): `machine` — written by an AI from
 * the English source on 2026-10-21; no native speaker has read it. The title
 * (`nestedTicTacToeName`) is a proper noun and stays as-is.
 *
 * Glossary (§12), one word each: small board = tabuleiro pequeno · square =
 * casa · send = enviar · take / taken = tomar / tomado (never "vencer", which
 * is the match) · closed = fechado · open = aberto · first / second =
 * Primeiro / Segundo · cross / circle = xis / círculo. The record note puts
 * each number after its label, as the English does, so a count of 1 needs no
 * singular.
 */
import type { NestedTicTacToeMessages } from './en';

export const ptBR: NestedTicTacToeMessages = {
  nestedTicTacToeName: 'Nested Tic-Tac-Toe',
  nestedTicTacToeChooseOpponent: 'Escolha seu adversário',
  nestedTicTacToeDifficulty_easy: 'Fácil',
  nestedTicTacToeDifficulty_normal: 'Normal',
  nestedTicTacToeDifficulty_hard: 'Difícil',
  nestedTicTacToeRecordNote: 'Vitórias {wins} · Derrotas {losses}',
  nestedTicTacToeChooseSideLabel: 'Quem começa',
  nestedTicTacToePlayFirst: 'Primeiro',
  nestedTicTacToePlaySecond: 'Segundo',
  nestedTicTacToePlayFirstLabel: 'Primeiro, com o xis',
  nestedTicTacToePlaySecondLabel: 'Segundo, com o círculo',
  nestedTicTacToeConfirmSwitchTitle: 'Substituir a partida em andamento?',
  nestedTicTacToeConfirmSwitchBody:
    'Sua partida {current} será substituída por uma nova partida {next}.',
  nestedTicTacToeBoardLabel: 'Tabuleiro de Nested Tic-Tac-Toe, nove tabuleiros pequenos',
  nestedTicTacToeSmallOpen: 'Tabuleiro pequeno {board}: aberto',
  nestedTicTacToeSmallPlayable: 'Tabuleiro pequeno {board}: aberto, jogue aqui',
  nestedTicTacToeSmallMine: 'Tabuleiro pequeno {board}: tomado por você',
  nestedTicTacToeSmallCpu: 'Tabuleiro pequeno {board}: tomado pela CPU',
  nestedTicTacToeSmallOpponent: 'Tabuleiro pequeno {board}: tomado pela {player}',
  nestedTicTacToeSmallDrawn: 'Tabuleiro pequeno {board}: empate (fechado)',
  nestedTicTacToeCellEmpty: 'Tabuleiro pequeno {board}, casa {square}: vazia',
  nestedTicTacToeCellPlayable: 'Tabuleiro pequeno {board}, casa {square}: jogue aqui',
  nestedTicTacToeCellYourCross: 'Tabuleiro pequeno {board}, casa {square}: seu xis',
  nestedTicTacToeCellYourCircle: 'Tabuleiro pequeno {board}, casa {square}: seu círculo',
  nestedTicTacToeCellCpuCross: 'Tabuleiro pequeno {board}, casa {square}: xis da CPU',
  nestedTicTacToeCellOpponentCross: 'Tabuleiro pequeno {board}, casa {square}: xis da {player}',
  nestedTicTacToeCellCpuCircle: 'Tabuleiro pequeno {board}, casa {square}: círculo da CPU',
  nestedTicTacToeCellOpponentCircle:
    'Tabuleiro pequeno {board}, casa {square}: círculo da {player}',
  nestedTicTacToeYourTurnSent: 'Sua vez: jogue no tabuleiro com moldura',
  nestedTicTacToeYourTurnFree: 'Sua vez: jogue em qualquer tabuleiro aberto',
  nestedTicTacToeCpuTurn: 'Vez da CPU',
  nestedTicTacToeWinTitle: 'Você venceu',
  nestedTicTacToeWinBody: 'Três dos seus tabuleiros em linha.',
  nestedTicTacToeLoseTitle: 'A CPU venceu',
  nestedTicTacToeLoseBody: 'A CPU tomou três tabuleiros em linha.',
  nestedTicTacToeDrawTitle: 'Empate',
  nestedTicTacToeDrawBody:
    'Todos os tabuleiros pequenos fecharam, e ninguém tem três tabuleiros em linha.',
  nestedTicTacToeBoardsYou: 'Seus tabuleiros',
  nestedTicTacToeBoardsCpu: 'Tabuleiros da CPU',
  nestedTicTacToeWins: 'Vitórias',
  nestedTicTacToeLosses: 'Derrotas',
  nestedTicTacToeDraws: 'Empates',
  nestedTicTacToeStep1Title: 'Sua jogada envia o adversário',
  nestedTicTacToeStep1Body:
    'A casa onde você joga dentro de um tabuleiro pequeno decide em qual tabuleiro o adversário joga em seguida.',
  nestedTicTacToeStep2Title: 'Tomado ou cheio: qualquer tabuleiro aberto',
  nestedTicTacToeStep2Body:
    'Se esse tabuleiro estiver tomado ou cheio, jogue em qualquer tabuleiro aberto.',
  nestedTicTacToeStep3Title: 'Três tabuleiros em linha',
  nestedTicTacToeStep3Body:
    'Fazer três em linha toma um tabuleiro pequeno; três tabuleiros tomados em linha vencem a partida.',
};
