/**
 * Nested Tic-Tac-Toe — the Traditional Chinese catalog. Provenance
 * (docs/NESTED_TIC_TAC_TOE_RULES.md §12): `machine` — written by an AI from
 * the English source on 2026-10-21; no native speaker has read it. The title
 * (`nestedTicTacToeName`) is a proper noun and stays as-is.
 *
 * Glossary (§12), one word each: small board = 小棋盤 · square = 格 · send =
 * 送 · take / taken = 拿下 (never "贏", which is the match) · closed = 已結束
 * and open = 未結束 (not 關閉, the shell's Close button) · first / second =
 * 先手 / 後手 · cross / circle = 叉 / 圈 (one draws them: 畫叉 / 畫圈).
 */
import type { NestedTicTacToeMessages } from './en';

export const zhHant: NestedTicTacToeMessages = {
  nestedTicTacToeName: 'Nested Tic-Tac-Toe',
  nestedTicTacToeChooseOpponent: '選擇對手',
  nestedTicTacToeDifficulty_easy: '簡單',
  nestedTicTacToeDifficulty_normal: '普通',
  nestedTicTacToeDifficulty_hard: '困難',
  nestedTicTacToeRecordNote: '{wins} 勝 · {losses} 敗',
  nestedTicTacToeChooseSideLabel: '誰先下',
  nestedTicTacToePlayFirst: '先手',
  nestedTicTacToePlaySecond: '後手',
  nestedTicTacToePlayFirstLabel: '先手，畫叉',
  nestedTicTacToePlaySecondLabel: '後手，畫圈',
  nestedTicTacToeConfirmSwitchTitle: '要替換進行中的對局嗎？',
  nestedTicTacToeConfirmSwitchBody: '進行中的「{current}」對局會被新的「{next}」對局取代。',
  nestedTicTacToeBoardLabel: 'Nested Tic-Tac-Toe 棋盤，九個小棋盤',
  nestedTicTacToeSmallOpen: '小棋盤 {board}：未結束',
  nestedTicTacToeSmallPlayable: '小棋盤 {board}：未結束，可在此下',
  nestedTicTacToeSmallMine: '小棋盤 {board}：你已拿下',
  nestedTicTacToeSmallCpu: '小棋盤 {board}：CPU 已拿下',
  nestedTicTacToeSmallDrawn: '小棋盤 {board}：平手（已結束）',
  nestedTicTacToeCellEmpty: '小棋盤 {board}，第 {square} 格：空',
  nestedTicTacToeCellPlayable: '小棋盤 {board}，第 {square} 格：可在此下',
  nestedTicTacToeCellYourCross: '小棋盤 {board}，第 {square} 格：你的叉',
  nestedTicTacToeCellYourCircle: '小棋盤 {board}，第 {square} 格：你的圈',
  nestedTicTacToeCellCpuCross: '小棋盤 {board}，第 {square} 格：CPU 的叉',
  nestedTicTacToeCellCpuCircle: '小棋盤 {board}，第 {square} 格：CPU 的圈',
  nestedTicTacToeYourTurnSent: '輪到你了 —— 在有框的小棋盤裡下',
  nestedTicTacToeYourTurnFree: '輪到你了 —— 在任一未結束的小棋盤裡下',
  nestedTicTacToeCpuTurn: '輪到 CPU',
  nestedTicTacToeWinTitle: '你贏了',
  nestedTicTacToeWinBody: '你拿下的三個棋盤連成一線。',
  nestedTicTacToeLoseTitle: 'CPU 獲勝',
  nestedTicTacToeLoseBody: 'CPU 拿下了連成一線的三個棋盤。',
  nestedTicTacToeDrawTitle: '平手',
  nestedTicTacToeDrawBody: '所有小棋盤都已結束，雙方都沒有把三個棋盤連成一線。',
  nestedTicTacToeBoardsYou: '你拿下的棋盤',
  nestedTicTacToeBoardsCpu: 'CPU 拿下的棋盤',
  nestedTicTacToeWins: '勝',
  nestedTicTacToeLosses: '敗',
  nestedTicTacToeDraws: '和',
  nestedTicTacToeStep1Title: '落點把對手送到對應棋盤',
  nestedTicTacToeStep1Body: '你在小棋盤裡落子的位置，決定對手下一步要在哪個小棋盤裡下。',
  nestedTicTacToeStep2Title: '已拿下或已下滿：任選未結束的棋盤',
  nestedTicTacToeStep2Body: '如果那個棋盤已被拿下或已下滿，就在任一未結束的棋盤裡下。',
  nestedTicTacToeStep3Title: '三個棋盤連成一線',
  nestedTicTacToeStep3Body: '在小棋盤裡連成三個就拿下它；拿下的三個棋盤連成一線就獲勝。',
};
