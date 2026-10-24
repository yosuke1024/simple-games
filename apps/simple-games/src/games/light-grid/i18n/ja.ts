// AI translation draft, including Japanese; no human/native review claimed.
import type { LightGridMessages } from './en';
export const ja: LightGridMessages = {
  lightGridName: 'Light Grid',
  lightGridChoose: '盤の大きさを選ぶ',
  lightGridBest: '最少手数',
  lightGridBoard: '盤',
  lightGridClear: 'すべて消灯！',
  lightGridClearBody: 'すべてのライトが消えました。',
  lightGridRule1: 'マスを押すと、そのマスと上下左右の隣のマスが切り替わる。',
  lightGridRule2: 'すべてのライトを消そう。時間制限はない。',
  lightGridRule3: '何手でも戻せる。ヒントを押すと、次に押すマスがわかる。',
  lightGridCell: '{row} 行 {col} 列：{state}',
  lightGridOn: '点灯',
  lightGridOff: '消灯',
  lightGridHintNote: '{row} 行 {col} 列のマスを押してください。',
  lightGridHintEffect: '枠で囲んだ隣のマスも切り替わります。',
  lightGridHintAffected: 'ヒントのマスを押すと、ここも切り替わる',
  lightGridStatus: '点灯：{count}',
};
