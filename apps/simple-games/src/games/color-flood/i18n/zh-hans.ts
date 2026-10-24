// AI translation draft, including Japanese; no human/native review claimed.
import type { ColorFloodMessages } from './en';
export const zhHans: ColorFloodMessages = {
  colorFloodName: 'Color Flood',
  colorFloodChooseColour: '选择颜色',
  colorFloodChoose: '选择棋盘',
  colorFloodBest: '最少步数',
  colorFloodBoard: '棋盘',
  colorFloodClear: '同一种颜色！',
  colorFloodClearBody: '整个棋盘连成了一片。',
  colorFloodRule1: '从左上角开始，选择与你的区域相邻的颜色。',
  colorFloodRule2: '区域会变成所选颜色，并吸收所有相连的同色格子。',
  colorFloodRule3: '用更少步数覆盖棋盘。没有步数上限，随时可以撤销。',
  colorFloodCell: '第 {row} 行，第 {col} 列：{symbol}',
  colorFloodColour: '颜色 {number}：{symbol}',
  colorFloodStatus: '已连接：{count} / {total}',
};
