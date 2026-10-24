// AI translation draft, including Japanese; no human/native review claimed.
import type { LightGridMessages } from './en';
export const zhHans: LightGridMessages = {
  lightGridName: 'Light Grid',
  lightGridChoose: '选择棋盘',
  lightGridBest: '最少步数',
  lightGridBoard: '棋盘',
  lightGridClear: '灯全熄灭了！',
  lightGridClearBody: '所有灯都已熄灭。',
  lightGridRule1: '点击一格，会切换该格及上、下、左、右相邻格的灯。',
  lightGridRule2: '熄灭所有灯，没有时间限制。',
  lightGridRule3: '可撤销任意一步，或点击提示查看下一步该点哪格。',
  lightGridCell: '第 {row} 行，第 {col} 列：{state}',
  lightGridOn: '亮',
  lightGridOff: '灭',
  lightGridHintNote: '请点击第 {row} 行、第 {col} 列。',
  lightGridHintEffect: '框出的相邻格也会切换。',
  lightGridHintAffected: '点击提示格后，这格也会切换',
  lightGridStatus: '亮灯：{count}',
};
