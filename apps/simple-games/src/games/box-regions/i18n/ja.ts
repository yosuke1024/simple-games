/**
 * Japanese catalog for Box Regions (docs/I18N_POLICY.md: provenance
 * `author`). The title (`boxRegionsName`) is a proper noun and stays
 * as-is in every locale; placeholder names match the English source.
 */
import type { BoxRegionsMessages } from './en';

export const ja: BoxRegionsMessages = {
  boxRegionsName: 'Box Regions',
  boxRegionsChooseBoard: '盤面を選ぶ',
  boxRegionsDifficulty_easy: 'かんたん',
  boxRegionsDifficulty_medium: 'ふつう',
  boxRegionsDifficulty_hard: 'むずかしい',
  boxRegionsBoardNote: '{width}×{height}',
  boxRegionsConfirmSwitchTitle: '進行中の盤面を置き換えますか？',
  boxRegionsConfirmSwitchBody: '進行中の{current}のゲームは、新しい{next}の盤面に置き換わります。',
  boxRegionsBoardLabel: 'Box Regions の盤面、{width}×{height}',
  boxRegionsCellAssigned: '{row}行 {col}列、箱 {region}',
  boxRegionsCellEmpty: '{row}行 {col}列、未割り当て',
  boxRegionsClueCount: '{size}マス中 {count}マス',
  boxRegionsRuleBroken: 'ルール違反',
  boxRegionsKind_square: '正方形',
  boxRegionsKind_tall: '縦長',
  boxRegionsKind_wide: '横長',
  boxRegionsKind_free: '形は自由',
  boxRegionsHintWrong: '強調した箱は答えと合っていません。',
  boxRegionsHintForced: '印のマスは、強調した手がかりの箱にしか入りません。',
  boxRegionsHintSole: 'この箱の描き方は 1 つしかありません。',
  boxRegionsHintCommon: 'この手がかりの箱をどう描いても、印のマスが入ります。',
  boxRegionsHintNone: '今わかる手が見つかりません。',
  boxRegionsSolvedTitle: '完成！',
  boxRegionsSolvedBody: 'すべてのマスが箱に収まりました。',
  boxRegionsHintsUsed: 'ヒント使用',
  boxRegionsNewBestTime: '自己ベスト更新。',
  boxRegionsNewBoard: '新しい盤面',
  boxRegionsSolvedCount: 'クリア数',
  boxRegionsDailySection: 'デイリー',
  boxRegionsDailiesCleared: '達成日数',
  boxRegionsDailyBacklogHint: '過去の日はいつでも開けます。',
  boxRegionsStep1Title: '箱に切り分ける',
  boxRegionsStep1Body: '盤面を長方形の箱に切り分けます。どの箱にも手がかりが 1 つ。',
  boxRegionsStep2Title: '手がかりを読む',
  boxRegionsStep2Body: '数字は箱のマス数、記号は形（正方形・縦長・横長・自由）。',
  boxRegionsStep3Title: '角から角へなぞる',
  boxRegionsStep3Body: '角から角へなぞって箱を描き、タップで消します。詰まったらヒント。',
};
