import type { SchulteMessages } from './en';

export const ja: SchulteMessages = {
  schulteName: 'Schulte Table',

  schulteBoardLabel: '数字の盤面',
  schulteCell: '{value}、{row} 行 {col} 列',
  schulteCellDone: '{value}、{row} 行 {col} 列、タップ済み',
  schulteFind: '次',

  schulteDoneTitle: '全部見つけた',
  schulteDoneBody: '順番どおりに全部タップしました。',
  schulteMisses: '誤タップ',
  schulteNewBestTime: '自己ベスト更新。',
  schulteConfirmRestartBody: '最初の数字からやり直します。',

  schulteDailyBacklogHint: '過去の日はいつでも開きます。',
  schulteSizeLabel: '{n}×{n}',
  schulteLevelsDone: 'クリアしたレベル',
  schulteDailiesDone: '達成したデイリー',
  schulteTotalMisses: '誤タップ合計',

  schulteStep1Title: '1、2、3 の順にタップ',
  schulteStep1Body: '散らばった数字を、小さい順にタップします。',
  schulteStep2Title: '次の数字は盤面の上',
  schulteStep2Body: '押し間違えても減点はありません。盤面が待つだけです。',
  schulteStep3Title: '最後まで押し切る',
  schulteStep3Body: 'かかった時間を記録します。制限時間はありません。',
};
