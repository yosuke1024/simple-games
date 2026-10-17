/**
 * Peg Solitaire — the Traditional Chinese catalog. Provenance
 * (docs/PEG_SOLITAIRE_RULES.md §15): `machine` — written by an AI from the
 * English source; no native speaker has read it. The title
 * (`pegSolitaireName`) is a proper noun and stays as-is. The English board
 * is "英式" (English style), so the button does not read as the name of a
 * language. Rows are 列 and columns 欄, as in the other Traditional Chinese
 * catalogs (docs/I18N_POLICY.md); "新盤面" follows the Minesweeper catalog.
 */
import type { PegSolitaireMessages } from './en';

export const zhHant: PegSolitaireMessages = {
  pegSolitaireName: 'Peg Solitaire',

  pegSolitaireBoard_english: '英式',
  pegSolitaireBoard_triangle: '三角',
  pegSolitaireBoardLabel_english: '英式棋盤，33 孔',
  pegSolitaireBoardLabel_triangle: '三角棋盤，15 孔',
  pegSolitaireHoleCount: '{count} 孔',

  pegSolitaireChooseBoard: '選擇棋盤',
  pegSolitaireBestNote: '最少剩 {count} 顆',
  pegSolitaireConfirmSwitchTitle: '要替換進行中的遊戲嗎？',
  pegSolitaireConfirmSwitchBody: '進行中的「{current}」遊戲會被新的「{next}」遊戲取代。',

  pegSolitaireHoleGrid: '第 {row} 列第 {col} 欄：{content}',
  pegSolitaireHoleRow: '第 {row} 列第 {place} 個孔：{content}',
  pegSolitaireContentPeg: '有棋子',
  pegSolitaireContentPegRing: '帶圈的孔，有棋子',
  pegSolitaireContentEmpty: '空',
  pegSolitaireContentEmptyRing: '帶圈的孔，空',
  pegSolitaireContentLanding: '空，可以跳到這裡',
  pegSolitaireContentLandingRing: '帶圈的孔，空，可以跳到這裡',

  pegSolitairePegsLeft: '剩餘棋子：{count}',
  pegSolitaireNoJump: '這顆棋子現在無法跳。',

  pegSolitairePerfectTitle: '完美過關！',
  pegSolitairePerfectBody: '最後一顆棋子留在帶圈的孔裡。',
  pegSolitaireSingleTitle: '剩下一顆',
  pegSolitaireSingleBody: '最後一顆棋子不在帶圈的孔裡。',
  pegSolitaireStuckTitle: '無棋可跳',
  pegSolitaireStuckBody: '沒有棋子能再跳過別的棋子。',
  pegSolitairePegsLeftLabel: '剩餘棋子',
  pegSolitaireFewestLabel: '此棋盤最少',
  pegSolitaireNewFewest: '這是此棋盤上剩得最少的一次。',
  pegSolitaireBoardFact: '棋盤',
  pegSolitaireNewBoard: '新盤面',

  pegSolitaireStatFewest: '最少剩餘棋子',
  pegSolitaireStatPerfect: '完美過關',

  pegSolitaireStep1Title: '跳過並移除',
  pegSolitaireStep1Body: '讓棋子跳過相鄰的棋子落入空孔——被跳過的棋子會被移除。',
  pegSolitaireStep2Title: '只能直線跳',
  pegSolitaireStep2Body: '跳躍只走直線：英式可上下左右，三角沿三條線的方向。',
  pegSolitaireStep3Title: '留下最後一顆',
  pegSolitaireStep3Body: '沒有棋子能跳時遊戲結束——把最後一顆留在帶圈的孔裡就是完美過關。',
};
