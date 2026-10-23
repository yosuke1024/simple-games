// AI translation draft, including Japanese; no human/native review claimed.
import type { ColorFloodMessages } from './en';
export const ja: ColorFloodMessages = {
  colorFloodName: 'Color Flood',
  colorFloodChooseColour: '色を選ぶ',
  colorFloodChoose: '盤の大きさを選ぶ',
  colorFloodBest: '最少手数',
  colorFloodBoard: '盤',
  colorFloodClear: 'ひとつの色に！',
  colorFloodClearBody: '盤全体がつながりました。',
  colorFloodRule1: '左上のマスから始め、自分の領域に接する色を選ぶ。',
  colorFloodRule2: '領域の色が変わり、つながっている同じ色のマスを取り込む。',
  colorFloodRule3: '少ない手数で盤全体を染めよう。手数制限はなく、いつでも戻せる。',
  colorFloodCell: '{row} 行 {col} 列：{symbol}',
  colorFloodColour: '色 {number}：{symbol}',
  colorFloodStatus: 'つながったマス：{count} / {total}',
};
