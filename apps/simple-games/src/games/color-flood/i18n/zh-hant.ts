// AI translation draft, including Japanese; no human/native review claimed.
import type { ColorFloodMessages } from './en';
export const zhHant: ColorFloodMessages = {
  colorFloodName: 'Color Flood',
  colorFloodChooseColour: '選擇顏色',
  colorFloodChoose: '選擇棋盤',
  colorFloodBest: '最少步數',
  colorFloodBoard: '棋盤',
  colorFloodClear: '同一種顏色！',
  colorFloodClearBody: '整個棋盤連成了一片。',
  colorFloodRule1: '從左上角開始，選擇與你的區域相鄰的顏色。',
  colorFloodRule2: '區域會變成所選顏色，並吸收所有相連的同色格子。',
  colorFloodRule3: '用更少步數覆蓋棋盤。沒有步數上限，隨時可以復原。',
  colorFloodCell: '第 {row} 列，第 {col} 欄：{symbol}',
  colorFloodColour: '顏色 {number}：{symbol}',
  colorFloodStatus: '已連接：{count} / {total}',
};
