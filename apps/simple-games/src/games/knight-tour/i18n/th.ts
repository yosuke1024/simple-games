/** AI-authored translation draft; no human review claimed. See docs/KNIGHT_TOUR_RULES.md. */
import type { KnightTourMessages } from './en';
export const th: KnightTourMessages = {
  knightTourName: 'Knight’s Tour',
  knightTourVisited: 'เยี่ยมแล้ว: {count} / {total}',
  knightTourBoard: 'กระดาน',
  knightTourCurrent: 'ม้า ช่องปัจจุบัน',
  knightTourVisitNumber: 'ลำดับที่ {count}',
  knightTourLegal: 'ช่องที่เดินได้',
  knightTourEmpty: 'ยังไม่เยี่ยม',
  knightTourCell: 'แถว {row} คอลัมน์ {col}: {content}',
  knightTourPaused: 'หยุดชั่วคราว เล่นต่อเมื่อพร้อม',
  knightTourStuck: 'ไม่มีทางเดินต่อ ย้อนกลับเพื่อลองเส้นทางอื่น',
  knightTourInstruction: 'เดินเป็นตัว L ไปยังช่องที่มีจุด',
  knightTourNewBoard: 'กระดานใหม่',
  knightTourWon: 'เดินครบแล้ว!',
  knightTourWins: 'สำเร็จ',
  knightTourStep1Title: 'เดินเป็นตัว L',
  knightTourStep1Body: 'ม้าเดินสองช่องในทิศหนึ่ง แล้วหนึ่งช่องด้านข้าง จุดแสดงช่องที่เดินได้',
  knightTourStep2Title: 'เยี่ยมแต่ละช่องครั้งเดียว',
  knightTourStep2Body: 'ทุกช่องที่เยี่ยมจะมีหมายเลขกำกับ และกลับไปช่องเดิมไม่ได้',
  knightTourStep3Title: 'สำรวจตามจังหวะของคุณ',
  knightTourStep3Body: 'เยี่ยมทุกช่องเพื่อจบ หากติดทางตัน ย้อนกลับแล้วลองเส้นทางอื่นได้',
};
