// AI translation draft, including Japanese; no human/native review claimed.
import type { ColorFloodMessages } from './en';
export const th: ColorFloodMessages = {
  colorFloodName: 'Color Flood',
  colorFloodChooseColour: 'เลือกสี',
  colorFloodChoose: 'เลือกกระดาน',
  colorFloodBest: 'จำนวนครั้งน้อยที่สุด',
  colorFloodBoard: 'กระดาน',
  colorFloodClear: 'สีเดียวกันแล้ว!',
  colorFloodClearBody: 'ทั้งกระดานเชื่อมกันแล้ว',
  colorFloodRule1: 'เริ่มจากช่องซ้ายบน แล้วเลือกสีที่ติดกับพื้นที่ของคุณ',
  colorFloodRule2: 'พื้นที่จะเปลี่ยนสีและรวมช่องสีเดียวกันที่เชื่อมต่อกันทั้งหมด',
  colorFloodRule3:
    'เติมทั้งกระดานด้วยจำนวนครั้งที่น้อยลง ไม่มีการจำกัดจำนวนครั้ง และย้อนกลับได้เสมอ',
  colorFloodCell: 'แถว {row} คอลัมน์ {col}: {symbol}',
  colorFloodColour: 'สี {number}: {symbol}',
  colorFloodStatus: 'เชื่อมแล้ว: {count} / {total}',
};
