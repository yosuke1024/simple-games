import type { BlockPuzzleMessages } from './en';

export const th: BlockPuzzleMessages = {
  blockName: 'Block Puzzle',
  blockBoardLabel: 'กระดานบล็อก 8 คูณ 8',
  blockCellFilled: 'แถว {row} คอลัมน์ {col}: มีบล็อก',
  blockCellEmpty: 'แถว {row} คอลัมน์ {col}: ว่าง',
  blockTrayLabel: 'ชิ้นส่วน',
  blockPieceLabel: 'ชิ้นที่ {n}, {cells} ช่อง',
  blockPieceUsed: 'ชิ้นที่ {n}, วางแล้ว',
  blockPieceSelected: 'เลือกชิ้นที่ {n} แล้ว',
  blockBestScore: 'คะแนนสูงสุด',
  blockLines: 'เส้นที่เคลียร์',
  blockOverTitle: 'ไม่มีที่ว่างแล้ว',
  blockOverBody: 'ไม่มีชิ้นไหนวางลงบนกระดานได้',
  blockNewBestScore: 'คะแนนสูงสุดของคุณ!',
  blockStep1Title: 'ลากชิ้นส่วนลงกระดาน',
  blockStep1Body: 'ลากชิ้นใดก็ได้จากสามชิ้นลงบนกระดาน ชิ้นส่วนหมุนไม่ได้',
  blockStep2Title: 'เติมแถวหรือคอลัมน์ให้เต็ม',
  blockStep2Body: 'เส้นที่เต็มจะหายไป และเคลียร์หลายเส้นพร้อมกันได้คะแนนมากกว่า',
  blockStep3Title: 'เล่นจนวางไม่ได้',
  blockStep3Body: 'ย้อนกลับได้ฟรีไม่จำกัด วางผิดจึงไม่เสียอะไร',
};
