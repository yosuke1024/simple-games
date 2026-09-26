/**
 * Japanese catalog for Shape Regions (docs/I18N_POLICY.md: provenance
 * `author`). The title (`shapeRegionsName`) is a proper noun and stays
 * as-is in every locale; placeholder names match the English source.
 */
import type { ShapeRegionsMessages } from './en';

export const ja: ShapeRegionsMessages = {
  shapeRegionsName: 'Shape Regions',
  shapeRegionsChooseBoard: '盤面を選ぶ',
  shapeRegionsDifficulty_easy: 'かんたん',
  shapeRegionsDifficulty_medium: 'ふつう',
  shapeRegionsDifficulty_hard: 'むずかしい',
  shapeRegionsBoardNote: '{width}×{height}',
  shapeRegionsConfirmSwitchTitle: '進行中の盤面を置き換えますか？',
  shapeRegionsConfirmSwitchBody:
    '進行中の{current}のゲームは、新しい{next}の盤面に置き換わります。',
  shapeRegionsBoardLabel: 'Shape Regions の盤面、{width}×{height}',
  shapeRegionsCellAssigned: '{row}行 {col}列、形 {region}',
  shapeRegionsCellEmpty: '{row}行 {col}列、未割り当て',
  shapeRegionsClueCount: '{size}マス中 {count}マス',
  shapeRegionsRuleBroken: 'ルール違反',
  shapeRegionsShape_line: '一直線',
  shapeRegionsShape_block: '長方形',
  shapeRegionsShape_corner: 'L字',
  shapeRegionsShape_tee: 'T字',
  shapeRegionsShape_step: '段違い',
  shapeRegionsHintWrong: '強調した形は答えと合っていません。',
  shapeRegionsHintForced: '印のマスは、強調した形にしか入りません。',
  shapeRegionsHintSole: '強調した形の置き方は 1 つしかありません。',
  shapeRegionsHintCommon: '強調した形のどの置き方にも、印のマスが入ります。',
  shapeRegionsHintNone: '今わかる手が見つかりません。',
  shapeRegionsSolvedTitle: '完成！',
  shapeRegionsSolvedBody: 'すべてのマスが形に属しました。',
  shapeRegionsHintsUsed: 'ヒント使用',
  shapeRegionsNewBestTime: '自己ベスト更新。',
  shapeRegionsNewBoard: '新しい盤面',
  shapeRegionsSolvedCount: 'クリア数',
  shapeRegionsDailySection: 'デイリー',
  shapeRegionsDailiesCleared: '達成日数',
  shapeRegionsDailyBacklogHint: '過去の日はいつでも開けます。',
  shapeRegionsStep1Title: '数字と記号',
  shapeRegionsStep1Body: '数字はその形のマス数、記号はその形。',
  shapeRegionsStep2Title: '手がかりから育てる',
  shapeRegionsStep2Body: '手がかりから隣のマスへなぞると、形が育ちます。',
  shapeRegionsStep3Title: '盤面を埋める',
  shapeRegionsStep3Body: 'すべてのマスがどれかの形に属したら完成。タップで外せます。',
};
