/**
 * Thai catalog for Unblock Puzzle. Provenance: `machine` — written with
 * AI assistance from the English source; no native speaker has read it
 * (docs/UNBLOCK_PUZZLE_RULES.md §15, docs/I18N_POLICY.md「翻訳の状態は来歴と
 * 検証できた事実で書く」). The title (`unblockPuzzleName`) is a proper noun and
 * stays as-is in every locale; placeholder names match the English source.
 * Shared words (Undo, Hint, Moves, Daily Challenge, …) follow the shell's
 * src/i18n/locales/th.ts.
 */
import type { UnblockPuzzleMessages } from './en';

export const th: UnblockPuzzleMessages = {
  unblockPuzzleName: 'Unblock Puzzle',
  unblockPuzzleChooseBoard: 'เลือกกระดาน',
  unblockPuzzleDifficulty_easy: 'ง่าย',
  unblockPuzzleDifficulty_medium: 'ปานกลาง',
  unblockPuzzleDifficulty_hard: 'ยาก',
  unblockPuzzleRange: '{min}–{max} ตา',
  unblockPuzzleRangeOpen: '{min} ตาขึ้นไป',
  unblockPuzzleConfirmSwitchTitle: 'แทนที่กระดานที่กำลังเล่นอยู่หรือไม่?',
  unblockPuzzleConfirmSwitchBody:
    'กระดานระดับ {current} ของคุณจะถูกแทนที่ด้วยกระดานระดับ {next} ใหม่',
  unblockPuzzleBoardLabel: 'กระดาน {cols} คูณ {rows} ทางออกอยู่ที่ปลายขวาของแถว {row}',
  unblockPuzzleBlockTarget:
    'บล็อกเป้าหมาย แถว {row} คอลัมน์ {from} ถึง {to} ช่องว่าง: ซ้าย {left} ขวา {right}',
  unblockPuzzleBlockH:
    'บล็อกแนวนอน แถว {row} คอลัมน์ {from} ถึง {to} ช่องว่าง: ซ้าย {left} ขวา {right}',
  unblockPuzzleBlockV:
    'บล็อกแนวตั้ง คอลัมน์ {col} แถว {from} ถึง {to} ช่องว่าง: บน {up} ล่าง {down}',
  unblockPuzzleMovesStatus: 'จำนวนตา {moves} · น้อยสุด {min}',
  unblockPuzzleMoveLeft: 'เลื่อนไปทางซ้าย',
  unblockPuzzleMoveRight: 'เลื่อนไปทางขวา',
  unblockPuzzleMoveUp: 'เลื่อนขึ้น',
  unblockPuzzleMoveDown: 'เลื่อนลง',
  unblockPuzzleSelectPrompt: 'แตะบล็อกเพื่อเลื่อน',
  unblockPuzzleHintTarget: 'คำใบ้: เลื่อนบล็อกเป้าหมายไปที่คอลัมน์ {toFrom}–{toTo}',
  unblockPuzzleHintH:
    'คำใบ้: เลื่อนบล็อกในแถว {row} คอลัมน์ {from}–{to} ไปที่คอลัมน์ {toFrom}–{toTo}',
  unblockPuzzleHintV: 'คำใบ้: เลื่อนบล็อกในคอลัมน์ {col} แถว {from}–{to} ไปที่แถว {toFrom}–{toTo}',
  unblockPuzzleHintShown: 'เลื่อนบล็อกที่มีเครื่องหมายไปยังกรอบเส้นประ',
  unblockPuzzleHintNone: 'ไม่พบตาเดินจากตรงนี้',
  unblockPuzzleSolvedTitle: 'สำเร็จ!',
  unblockPuzzleSolvedBody: 'บล็อกเป้าหมายออกไปแล้ว',
  unblockPuzzleSolvedOptimal: 'ออกได้ด้วยจำนวนตาน้อยที่สุด',
  unblockPuzzleFewestLabel: 'ตาน้อยที่สุด',
  unblockPuzzleNetCellsLabel: 'ระยะเลื่อนสุทธิ',
  unblockPuzzleHintsUsed: 'คำใบ้ที่ใช้',
  unblockPuzzleNewBestTime: 'เร็วที่สุดของคุณในระดับ {difficulty}',
  unblockPuzzleNewBestDailyMoves: 'ใช้ตาน้อยที่สุดของคุณบนกระดานวันนี้',
  unblockPuzzleNewBoard: 'กระดานใหม่',
  unblockPuzzleSolvedCount: 'กระดานที่ผ่าน',
  unblockPuzzleOptimalCount: 'ผ่านด้วยตาน้อยที่สุด',
  unblockPuzzleOverallSection: 'ภาพรวม',
  unblockPuzzleDailiesCleared: 'ชาเลนจ์รายวันที่ผ่าน',
  unblockPuzzleStep1Title: 'เลื่อนตามแนวของตัวเอง',
  unblockPuzzleStep1Body: 'บล็อกแต่ละอันเลื่อนได้เฉพาะตามแนวของตัวเอง คือซ้ายขวา หรือขึ้นลง',
  unblockPuzzleStep2Title: 'พาเป้าหมายออกไป',
  unblockPuzzleStep2Body: 'เลื่อนบล็อกเป้าหมายออกทางออกด้านขวาเพื่อผ่านกระดาน',
  unblockPuzzleStep3Title: 'เลื่อนหนึ่งครั้ง นับหนึ่งตา',
  unblockPuzzleStep3Body: 'เลื่อนไกลแค่ไหนก็นับเป็นหนึ่งตา และใช้ย้อนกลับกับคำใบ้ได้ทุกเมื่อ',
};
