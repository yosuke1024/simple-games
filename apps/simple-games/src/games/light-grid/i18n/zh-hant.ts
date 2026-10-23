// AI translation draft, including Japanese; no human/native review claimed.
import type { LightGridMessages } from './en';
export const zhHant: LightGridMessages = {
  lightGridName: 'Light Grid',
  lightGridChoose: '選擇棋盤',
  lightGridBest: '最少步數',
  lightGridBoard: '棋盤',
  lightGridClear: '燈全熄滅了！',
  lightGridClearBody: '所有燈都已熄滅。',
  lightGridRule1: '點一下格子，會切換該格及上、下、左、右相鄰格的燈。',
  lightGridRule2: '熄滅所有燈，沒有時間限制。',
  lightGridRule3: '可復原任意一步，或點提示查看下一步該點哪格。',
  lightGridCell: '第 {row} 列，第 {col} 欄：{state}',
  lightGridOn: '亮',
  lightGridOff: '滅',
  lightGridHintNote: '請點第 {row} 列、第 {col} 欄。',
  lightGridHintEffect: '框出的相鄰格也會切換。',
  lightGridHintAffected: '點提示格後，這格也會切換',
  lightGridStatus: '亮燈：{count}',
};
