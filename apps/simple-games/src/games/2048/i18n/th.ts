import type { Game2048Messages } from './en';

export const th: Game2048Messages = {
  mergeName: '2048',
  mergeBoardLabel: 'กระดาน 2048 ขนาด 4 คูณ 4',
  mergeCell: 'แถว {row} คอลัมน์ {col}: {value}',
  mergeCellEmpty: 'แถว {row} คอลัมน์ {col}: ว่าง',
  mergeBestScore: 'คะแนนสูงสุด',
  mergeBestTile: 'ไทล์ที่ใหญ่ที่สุด',
  mergeReachedCount: 'จำนวนครั้งที่ถึง 2048',
  mergeReachedTitle: 'คุณถึง 2048 แล้ว!',
  mergeReachedBody: 'เล่นต่อได้เลย กระดานยังไปต่อได้',
  mergeKeepGoing: 'เล่นต่อ',
  mergeOverTitle: 'ไม่มีตาให้เดินแล้ว',
  mergeOverBody: 'ทุกช่องเต็มและไม่มีอะไรรวมกันได้อีก',
  mergeNewBestScore: 'คะแนนสูงสุดของคุณ',
  mergeStep1Title: 'ปัดเพื่อเลื่อน',
  mergeStep1Body: 'ไทล์ทุกอันเลื่อนไปทางนั้นพร้อมกัน และเลขเดียวกันสองอันจะรวมเป็นหนึ่ง',
  mergeStep2Title: 'ไทล์ใหม่จะปรากฏ',
  mergeStep2Body: 'ทุกตาที่ทำให้กระดานเปลี่ยน จะมีไทล์เพิ่มมาหนึ่งอัน',
  mergeStep3Title: 'ตันแล้ว? ย้อนกลับได้',
  mergeStep3Body: 'ย้อนกลับได้ฟรีไม่จำกัด และไม่สุ่มไทล์ที่เพิ่งได้ใหม่',
};
