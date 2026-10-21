/**
 * Nested Tic-Tac-Toe — the Simplified Chinese catalog. Provenance
 * (docs/NESTED_TIC_TAC_TOE_RULES.md §12): `machine` — written by an AI from
 * the English source on 2026-10-21; no native speaker has read it. The title
 * (`nestedTicTacToeName`) is a proper noun and stays as-is.
 *
 * Glossary (§12), one word each: small board = 小棋盘 · square = 格 · send =
 * 送 · take / taken = 拿下 (never "赢", which is the match) · closed = 已结束
 * and open = 未结束 (not 关闭, the shell's Close button) · first / second =
 * 先手 / 后手 · cross / circle = 叉 / 圈 (one draws them: 画叉 / 画圈).
 */
import type { NestedTicTacToeMessages } from './en';

export const zhHans: NestedTicTacToeMessages = {
  nestedTicTacToeName: 'Nested Tic-Tac-Toe',
  nestedTicTacToeChooseOpponent: '选择对手',
  nestedTicTacToeDifficulty_easy: '简单',
  nestedTicTacToeDifficulty_normal: '普通',
  nestedTicTacToeDifficulty_hard: '困难',
  nestedTicTacToeRecordNote: '{wins} 胜 · {losses} 负',
  nestedTicTacToeChooseSideLabel: '谁先下',
  nestedTicTacToePlayFirst: '先手',
  nestedTicTacToePlaySecond: '后手',
  nestedTicTacToePlayFirstLabel: '先手，画叉',
  nestedTicTacToePlaySecondLabel: '后手，画圈',
  nestedTicTacToeConfirmSwitchTitle: '替换进行中的对局？',
  nestedTicTacToeConfirmSwitchBody: '进行中的“{current}”对局会被新的“{next}”对局替换。',
  nestedTicTacToeBoardLabel: 'Nested Tic-Tac-Toe 棋盘，九个小棋盘',
  nestedTicTacToeSmallOpen: '小棋盘 {board}：未结束',
  nestedTicTacToeSmallPlayable: '小棋盘 {board}：未结束，可在此下',
  nestedTicTacToeSmallMine: '小棋盘 {board}：你已拿下',
  nestedTicTacToeSmallCpu: '小棋盘 {board}：CPU 已拿下',
  nestedTicTacToeSmallDrawn: '小棋盘 {board}：平局（已结束）',
  nestedTicTacToeCellEmpty: '小棋盘 {board}，第 {square} 格：空',
  nestedTicTacToeCellPlayable: '小棋盘 {board}，第 {square} 格：可在此下',
  nestedTicTacToeCellYourCross: '小棋盘 {board}，第 {square} 格：你的叉',
  nestedTicTacToeCellYourCircle: '小棋盘 {board}，第 {square} 格：你的圈',
  nestedTicTacToeCellCpuCross: '小棋盘 {board}，第 {square} 格：CPU 的叉',
  nestedTicTacToeCellCpuCircle: '小棋盘 {board}，第 {square} 格：CPU 的圈',
  nestedTicTacToeYourTurnSent: '轮到你了 —— 在带框的小棋盘里下',
  nestedTicTacToeYourTurnFree: '轮到你了 —— 在任意未结束的小棋盘里下',
  nestedTicTacToeCpuTurn: '轮到 CPU',
  nestedTicTacToeWinTitle: '你赢了',
  nestedTicTacToeWinBody: '你拿下的三个棋盘连成一线。',
  nestedTicTacToeLoseTitle: 'CPU 获胜',
  nestedTicTacToeLoseBody: 'CPU 拿下了连成一线的三个棋盘。',
  nestedTicTacToeDrawTitle: '平局',
  nestedTicTacToeDrawBody: '所有小棋盘都已结束，双方都没有把三个棋盘连成一线。',
  nestedTicTacToeBoardsYou: '你拿下的棋盘',
  nestedTicTacToeBoardsCpu: 'CPU 拿下的棋盘',
  nestedTicTacToeWins: '胜',
  nestedTicTacToeLosses: '负',
  nestedTicTacToeDraws: '平',
  nestedTicTacToeStep1Title: '落点把对手送到对应棋盘',
  nestedTicTacToeStep1Body: '你在小棋盘里落子的位置，决定对手下一步要在哪个小棋盘里下。',
  nestedTicTacToeStep2Title: '已拿下或已下满：任选未结束的棋盘',
  nestedTicTacToeStep2Body: '如果那个棋盘已被拿下或已下满，就在任意未结束的棋盘里下。',
  nestedTicTacToeStep3Title: '三个棋盘连成一线',
  nestedTicTacToeStep3Body: '在小棋盘里连成三个就拿下它；拿下的三个棋盘连成一线就获胜。',
};
