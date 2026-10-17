/**
 * Simplified Chinese catalog for Unblock Puzzle. Provenance: `machine` — written with
 * AI assistance from the English source; no native speaker has read it
 * (docs/UNBLOCK_PUZZLE_RULES.md §15, docs/I18N_POLICY.md「翻訳の状態は来歴と
 * 検証できた事実で書く」). The title (`unblockPuzzleName`) is a proper noun and
 * stays as-is in every locale; placeholder names match the English source.
 * Shared words (Undo, Hint, Moves, Daily Challenge, …) follow the shell's
 * src/i18n/locales/zh-hans.ts.
 */
import type { UnblockPuzzleMessages } from './en';

export const zhHans: UnblockPuzzleMessages = {
  unblockPuzzleName: 'Unblock Puzzle',
  unblockPuzzleChooseBoard: '选择棋盘',
  unblockPuzzleDifficulty_easy: '简单',
  unblockPuzzleDifficulty_medium: '中等',
  unblockPuzzleDifficulty_hard: '困难',
  unblockPuzzleRange: '{min}–{max} 步',
  unblockPuzzleRangeOpen: '{min} 步以上',
  unblockPuzzleConfirmSwitchTitle: '替换进行中的棋盘？',
  unblockPuzzleConfirmSwitchBody: '你正在进行的{current}棋盘将被新的{next}棋盘替换。',
  unblockPuzzleBoardLabel: '棋盘，{cols} 乘 {rows}。出口在第 {row} 行的右端。',
  unblockPuzzleBlockTarget:
    '目标方块，第 {row} 行，第 {from} 至 {to} 列。空格：左 {left}，右 {right}。',
  unblockPuzzleBlockH: '横向方块，第 {row} 行，第 {from} 至 {to} 列。空格：左 {left}，右 {right}。',
  unblockPuzzleBlockV: '纵向方块，第 {col} 列，第 {from} 至 {to} 行。空格：上 {up}，下 {down}。',
  unblockPuzzleMovesStatus: '步数 {moves} · 最少 {min}',
  unblockPuzzleMoveLeft: '向左移动',
  unblockPuzzleMoveRight: '向右移动',
  unblockPuzzleMoveUp: '向上移动',
  unblockPuzzleMoveDown: '向下移动',
  unblockPuzzleSelectPrompt: '点按方块来移动',
  unblockPuzzleHintTarget: '提示：把目标方块滑到第 {toFrom}–{toTo} 列。',
  unblockPuzzleHintH: '提示：把第 {row} 行第 {from}–{to} 列的方块滑到第 {toFrom}–{toTo} 列。',
  unblockPuzzleHintV: '提示：把第 {col} 列第 {from}–{to} 行的方块滑到第 {toFrom}–{toTo} 行。',
  unblockPuzzleHintShown: '把标记的方块滑到虚线框处。',
  unblockPuzzleHintNone: '从这里没有找到可走的一步。',
  unblockPuzzleSolvedTitle: '过关！',
  unblockPuzzleSolvedBody: '目标方块已经出去了。',
  unblockPuzzleSolvedOptimal: '用最少的步数走出。',
  unblockPuzzleFewestLabel: '最少步数',
  unblockPuzzleNetCellsLabel: '净移动格数',
  unblockPuzzleHintsUsed: '已用提示',
  unblockPuzzleNewBestTime: '你在{difficulty}难度的最快纪录。',
  unblockPuzzleNewBestDailyMoves: '你在今日棋盘上的最少步数纪录。',
  unblockPuzzleNewBoard: '新棋盘',
  unblockPuzzleSolvedCount: '已过关棋盘',
  unblockPuzzleOptimalCount: '以最少步数过关',
  unblockPuzzleOverallSection: '总体',
  unblockPuzzleDailiesCleared: '完成的每日挑战',
  unblockPuzzleStep1Title: '沿着自己的线滑动',
  unblockPuzzleStep1Body: '每个方块只能沿自己的方向滑动：横向的左右滑，纵向的上下滑。',
  unblockPuzzleStep2Title: '放出目标',
  unblockPuzzleStep2Body: '把目标方块从右侧出口滑出去即可过关。',
  unblockPuzzleStep3Title: '滑一次，算一步',
  unblockPuzzleStep3Body: '无论滑多远都算一步，撤销和提示随时可用。',
};
