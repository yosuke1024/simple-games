/**
 * Traditional Chinese catalog for Unblock Puzzle. Provenance: `machine` — written with
 * AI assistance from the English source; no native speaker has read it
 * (docs/UNBLOCK_PUZZLE_RULES.md §15, docs/I18N_POLICY.md「翻訳の状態は来歴と
 * 検証できた事実で書く」). The title (`unblockPuzzleName`) is a proper noun and
 * stays as-is in every locale; placeholder names match the English source.
 * Shared words (Undo, Hint, Moves, Daily Challenge, …) follow the shell's
 * src/i18n/locales/zh-hant.ts.
 */
import type { UnblockPuzzleMessages } from './en';

export const zhHant: UnblockPuzzleMessages = {
  unblockPuzzleName: 'Unblock Puzzle',
  unblockPuzzleChooseBoard: '選擇棋盤',
  unblockPuzzleDifficulty_easy: '簡單',
  unblockPuzzleDifficulty_medium: '中等',
  unblockPuzzleDifficulty_hard: '困難',
  unblockPuzzleRange: '{min}–{max} 步',
  unblockPuzzleRangeOpen: '{min} 步以上',
  unblockPuzzleConfirmSwitchTitle: '取代進行中的棋盤？',
  unblockPuzzleConfirmSwitchBody: '你正在進行的{current}棋盤將被新的{next}棋盤取代。',
  unblockPuzzleBoardLabel: '棋盤，{cols} 乘 {rows}。出口在第 {row} 列的右端。',
  unblockPuzzleBlockTarget:
    '目標方塊，第 {row} 列，第 {from} 至 {to} 欄。空格：左 {left}，右 {right}。',
  unblockPuzzleBlockH: '橫向方塊，第 {row} 列，第 {from} 至 {to} 欄。空格：左 {left}，右 {right}。',
  unblockPuzzleBlockV: '縱向方塊，第 {col} 欄，第 {from} 至 {to} 列。空格：上 {up}，下 {down}。',
  unblockPuzzleMovesStatus: '步數 {moves} · 最少 {min}',
  unblockPuzzleMoveLeft: '向左移動',
  unblockPuzzleMoveRight: '向右移動',
  unblockPuzzleMoveUp: '向上移動',
  unblockPuzzleMoveDown: '向下移動',
  unblockPuzzleSelectPrompt: '點一下方塊來移動',
  unblockPuzzleHintTarget: '提示：把目標方塊滑到第 {toFrom}–{toTo} 欄。',
  unblockPuzzleHintH: '提示：把第 {row} 列第 {from}–{to} 欄的方塊滑到第 {toFrom}–{toTo} 欄。',
  unblockPuzzleHintV: '提示：把第 {col} 欄第 {from}–{to} 列的方塊滑到第 {toFrom}–{toTo} 列。',
  unblockPuzzleHintShown: '把標記的方塊滑到虛線框處。',
  unblockPuzzleHintNone: '從這裡找不到可走的一步。',
  unblockPuzzleSolvedTitle: '過關！',
  unblockPuzzleSolvedBody: '目標方塊已經出去了。',
  unblockPuzzleSolvedOptimal: '以最少步數走出。',
  unblockPuzzleFewestLabel: '最少步數',
  unblockPuzzleNetCellsLabel: '淨移動格數',
  unblockPuzzleHintsUsed: '已使用提示',
  unblockPuzzleNewBestTime: '你在{difficulty}難度的最快紀錄。',
  unblockPuzzleNewBestDailyMoves: '你在今日棋盤上的最少步數紀錄。',
  unblockPuzzleNewBoard: '新棋盤',
  unblockPuzzleSolvedCount: '已過關棋盤',
  unblockPuzzleOptimalCount: '以最少步數過關',
  unblockPuzzleOverallSection: '總體',
  unblockPuzzleDailiesCleared: '完成的每日挑戰',
  unblockPuzzleStep1Title: '沿著自己的線滑動',
  unblockPuzzleStep1Body: '每個方塊只能沿自己的方向滑動：橫向的左右滑，縱向的上下滑。',
  unblockPuzzleStep2Title: '放出目標',
  unblockPuzzleStep2Body: '把目標方塊從右側出口滑出去就過關。',
  unblockPuzzleStep3Title: '滑一次，算一步',
  unblockPuzzleStep3Body: '無論滑多遠都算一步，復原和提示隨時可用。',
};
