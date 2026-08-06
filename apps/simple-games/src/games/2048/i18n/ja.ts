import type { Game2048Messages } from './en';

export const ja: Game2048Messages = {
  mergeName: '2048',
  mergeBoardLabel: '2048の盤面、4×4',
  mergeCell: '{row}行{col}列:{value}',
  mergeCellEmpty: '{row}行{col}列:空',
  mergeBestScore: '最高スコア',
  mergeBestTile: '最大タイル',
  mergeReachedCount: '2048に到達した回数',
  mergeReachedTitle: '2048に到達!',
  mergeReachedBody: 'まだ続けられます。そのままどうぞ。',
  mergeKeepGoing: '続ける',
  mergeOverTitle: '動かせる手がありません',
  mergeOverBody: '盤面が埋まり、結合できる組もありません。',
  mergeNewBestScore: '自己最高スコアです。',
  mergeStep1Title: '倒して滑らせる',
  mergeStep1Body: 'すべてのタイルが一斉に滑り、同じ数字どうしは1つになります。',
  mergeStep2Title: '新しいタイルが増える',
  mergeStep2Body: '盤面が変わった手のあとに、タイルが1つ増えます。',
  mergeStep3Title: '詰まったら戻せる',
  mergeStep3Body: '「戻す」は無料で何度でも。直前に出たタイルが振り直されることもありません。',
};
