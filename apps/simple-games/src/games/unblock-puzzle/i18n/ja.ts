/**
 * Japanese catalog for Unblock Puzzle. Provenance: drafted by an AI and
 * **not yet read by the author** (docs/UNBLOCK_PUZZLE_RULES.md §15,
 * docs/I18N_POLICY.md「翻訳の状態は来歴と検証できた事実で書く」). The rest of the
 * collection's Japanese is the author's own; this game's is not, until the
 * author has read it. The title (`unblockPuzzleName`) is a proper noun and
 * stays as-is in every locale; placeholder names match the English source.
 */
import type { UnblockPuzzleMessages } from './en';

export const ja: UnblockPuzzleMessages = {
  unblockPuzzleName: 'Unblock Puzzle',
  unblockPuzzleChooseBoard: '盤面を選ぶ',
  unblockPuzzleDifficulty_easy: 'かんたん',
  unblockPuzzleDifficulty_medium: 'ふつう',
  unblockPuzzleDifficulty_hard: 'むずかしい',
  unblockPuzzleRange: '{min}〜{max} 手',
  unblockPuzzleRangeOpen: '{min} 手以上',
  unblockPuzzleConfirmSwitchTitle: '進行中の盤面を置き換えますか？',
  unblockPuzzleConfirmSwitchBody: '進行中の{current}の盤面は、新しい{next}の盤面に置き換わります。',
  unblockPuzzleBoardLabel: '盤面、{cols}×{rows}。出口は {row} 行目の右端です。',
  unblockPuzzleBlockTarget:
    'ターゲットのブロック、{row} 行目、{from}〜{to} 列。空きマスは左に {left}、右に {right}。',
  unblockPuzzleBlockH:
    '横向きのブロック、{row} 行目、{from}〜{to} 列。空きマスは左に {left}、右に {right}。',
  unblockPuzzleBlockV:
    '縦向きのブロック、{col} 列目、{from}〜{to} 行。空きマスは上に {up}、下に {down}。',
  unblockPuzzleMovesStatus: '手数 {moves}・最短 {min}',
  unblockPuzzleMoveLeft: '左へ動かす',
  unblockPuzzleMoveRight: '右へ動かす',
  unblockPuzzleMoveUp: '上へ動かす',
  unblockPuzzleMoveDown: '下へ動かす',
  unblockPuzzleSelectPrompt: 'ブロックをタップして選ぶ',
  unblockPuzzleHintTarget: 'ヒント: ターゲットのブロックを {toFrom}〜{toTo} 列へ。',
  unblockPuzzleHintH: 'ヒント: {row} 行目の {from}〜{to} 列のブロックを {toFrom}〜{toTo} 列へ。',
  unblockPuzzleHintV: 'ヒント: {col} 列目の {from}〜{to} 行のブロックを {toFrom}〜{toTo} 行へ。',
  unblockPuzzleHintShown: '印のブロックを点線の位置へ滑らせます。',
  unblockPuzzleHintNone: 'ここからの手は見つかりませんでした。',
  unblockPuzzleSolvedTitle: 'クリア！',
  unblockPuzzleSolvedBody: 'ターゲットのブロックが出口から出ました。',
  unblockPuzzleSolvedOptimal: '最短の手数で出口に着きました。',
  unblockPuzzleFewestLabel: '最短手数',
  unblockPuzzleNetCellsLabel: '正味の移動マス数',
  unblockPuzzleHintsUsed: 'ヒント使用',
  unblockPuzzleNewBestTime: '{difficulty}の自己最速です。',
  unblockPuzzleNewBestDailyMoves: '今日の盤面の自己最少手数です。',
  unblockPuzzleNewBoard: '新しい盤面',
  unblockPuzzleSolvedCount: 'クリア数',
  unblockPuzzleOptimalCount: '最短手数でのクリア',
  unblockPuzzleOverallSection: '全体',
  unblockPuzzleDailiesCleared: 'デイリーの達成日数',
  unblockPuzzleStep1Title: '線に沿って滑らせる',
  unblockPuzzleStep1Body: 'ブロックは自分の向きにだけ滑ります(横向きは左右、縦向きは上下)。',
  unblockPuzzleStep2Title: 'ターゲットを出す',
  unblockPuzzleStep2Body: 'ターゲットのブロックを右の出口から出せばクリアです。',
  unblockPuzzleStep3Title: '1 回滑らせて 1 手',
  unblockPuzzleStep3Body: '何マス滑らせても 1 手と数え、「戻す」と「ヒント」はいつでも使えます。',
};
