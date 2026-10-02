/**
 * Traditional Chinese catalog for Box Regions — machine translation of the English
 * source, unreviewed (docs/I18N_POLICY.md: provenance `machine`). The title
 * (`boxRegionsName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source.
 */
import type { BoxRegionsMessages } from './en';

export const zhHant: BoxRegionsMessages = {
  boxRegionsName: 'Box Regions',
  boxRegionsChooseBoard: '選擇棋盤',
  boxRegionsDifficulty_easy: '簡單',
  boxRegionsDifficulty_medium: '中等',
  boxRegionsDifficulty_hard: '困難',
  boxRegionsBoardNote: '{width}×{height}',
  boxRegionsConfirmSwitchTitle: '取代進行中的棋盤？',
  boxRegionsConfirmSwitchBody: '你正在進行的{current}遊戲將被新的{next}棋盤取代。',
  boxRegionsBoardLabel: 'Box Regions 棋盤，{width} 乘 {height}',
  boxRegionsCellAssigned: '第 {row} 列，第 {col} 欄，方框 {region}',
  boxRegionsCellEmpty: '第 {row} 列，第 {col} 欄，未分配',
  boxRegionsClueCount: '{size} 格中的 {count} 格',
  boxRegionsRuleBroken: '違反規則',
  boxRegionsKind_square: '正方形',
  boxRegionsKind_tall: '直長',
  boxRegionsKind_wide: '橫長',
  boxRegionsKind_free: '任意方框',
  boxRegionsHintWrong: '標示的方框與答案不符。',
  boxRegionsHintForced: '標記的格子只能屬於標示線索的方框。',
  boxRegionsHintSole: '這個方框只有一種畫法。',
  boxRegionsHintCommon: '無論怎樣畫這條線索的方框，都會涵蓋標記的格子。',
  boxRegionsHintNone: '目前找不到確定的一步。',
  boxRegionsSolvedTitle: '完成！',
  boxRegionsSolvedBody: '每個格子都在自己的方框裡。',
  boxRegionsHintsUsed: '已使用提示',
  boxRegionsNewBestTime: '你的最快紀錄。',
  boxRegionsNewBoard: '新棋盤',
  boxRegionsSolvedCount: '已解謎題',
  boxRegionsDailySection: '每日',
  boxRegionsDailiesCleared: '已完成天數',
  boxRegionsStep1Title: '分成方框',
  boxRegionsStep1Body: '把棋盤分成矩形，每個矩形恰好包含一條線索。',
  boxRegionsStep2Title: '讀懂線索',
  boxRegionsStep2Body: '數字代表方框包含的格數；符號代表正方形、直長、橫長或任意。',
  boxRegionsStep3Title: '從角拖曳到角',
  boxRegionsStep3Body: '從一個角拖曳到對角來畫方框。點一下方框即可刪除。卡住了？試試提示。',
};
