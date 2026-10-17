/**
 * Peg Solitaire — the Simplified Chinese catalog. Provenance
 * (docs/PEG_SOLITAIRE_RULES.md §15): `machine` — written by an AI from the
 * English source; no native speaker has read it. The title
 * (`pegSolitaireName`) is a proper noun and stays as-is. The English board
 * is "英式" (English style), so the button does not read as the name of a
 * language. "新盘面" for a new problem follows the Minesweeper catalog.
 */
import type { PegSolitaireMessages } from './en';

export const zhHans: PegSolitaireMessages = {
  pegSolitaireName: 'Peg Solitaire',

  pegSolitaireBoard_english: '英式',
  pegSolitaireBoard_triangle: '三角',
  pegSolitaireBoardLabel_english: '英式棋盘，33 孔',
  pegSolitaireBoardLabel_triangle: '三角棋盘，15 孔',
  pegSolitaireHoleCount: '{count} 孔',

  pegSolitaireChooseBoard: '选择棋盘',
  pegSolitaireBestNote: '最少剩 {count} 颗',
  pegSolitaireConfirmSwitchTitle: '替换进行中的游戏？',
  pegSolitaireConfirmSwitchBody: '进行中的“{current}”游戏会被新的“{next}”游戏替换。',

  pegSolitaireHoleGrid: '第 {row} 行第 {col} 列：{content}',
  pegSolitaireHoleRow: '第 {row} 行第 {place} 个孔：{content}',
  pegSolitaireContentPeg: '有棋子',
  pegSolitaireContentPegRing: '带圈的孔，有棋子',
  pegSolitaireContentEmpty: '空',
  pegSolitaireContentEmptyRing: '带圈的孔，空',
  pegSolitaireContentLanding: '空，可以跳到这里',
  pegSolitaireContentLandingRing: '带圈的孔，空，可以跳到这里',

  pegSolitairePegsLeft: '剩余棋子：{count}',
  pegSolitaireNoJump: '这颗棋子现在无法跳。',

  pegSolitairePerfectTitle: '完美通关！',
  pegSolitairePerfectBody: '最后一颗棋子留在带圈的孔里。',
  pegSolitaireSingleTitle: '剩下一颗',
  pegSolitaireSingleBody: '最后一颗棋子不在带圈的孔里。',
  pegSolitaireStuckTitle: '无棋可跳',
  pegSolitaireStuckBody: '没有棋子能再跳过别的棋子。',
  pegSolitairePegsLeftLabel: '剩余棋子',
  pegSolitaireFewestLabel: '此棋盘最少',
  pegSolitaireNewFewest: '这是此棋盘上剩得最少的一次。',
  pegSolitaireBoardFact: '棋盘',
  pegSolitaireNewBoard: '新盘面',

  pegSolitaireStatFewest: '最少剩余棋子',
  pegSolitaireStatPerfect: '完美通关',

  pegSolitaireStep1Title: '跳过并移除',
  pegSolitaireStep1Body: '让棋子跳过相邻的棋子落入空孔——被跳过的棋子会被移除。',
  pegSolitaireStep2Title: '只能直线跳',
  pegSolitaireStep2Body: '跳跃只走直线：英式可上下左右，三角沿三条线的方向。',
  pegSolitaireStep3Title: '留下最后一颗',
  pegSolitaireStep3Body: '没有棋子能跳时游戏结束——把最后一颗留在带圈的孔里就是完美通关。',
};
