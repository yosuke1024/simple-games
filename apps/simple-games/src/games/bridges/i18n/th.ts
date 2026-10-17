/**
 * Thai catalog for Bridges. Provenance (docs/BRIDGES_RULES.md §14,
 * docs/I18N_POLICY.md): `machine` — written with AI assistance and **not read
 * by a native speaker**. The title (`bridgesName`) is a proper noun and stays
 * as-is in every locale; placeholder names match the English source.
 */
import type { BridgesMessages } from './en';

export const th: BridgesMessages = {
  bridgesName: 'Bridges',
  bridgesChooseBoard: 'เลือกกระดาน',
  bridgesDifficulty_easy: 'ง่าย',
  bridgesDifficulty_medium: 'ปานกลาง',
  bridgesDifficulty_hard: 'ยาก',
  bridgesBoardNote: '{width}×{height}',
  bridgesConfirmSwitchTitle: 'แทนที่กระดานที่กำลังเล่นอยู่หรือไม่?',
  bridgesConfirmSwitchBody: 'กระดานระดับ {current} ของคุณจะถูกแทนที่ด้วยกระดานระดับ {next} ใหม่',
  bridgesBoardLabel: 'กระดาน Bridges ขนาด {width} คูณ {height} มี {islands} เกาะ',
  bridgesIslandOpen: 'เกาะ {value} แถว {row} คอลัมน์ {col}: สะพาน {count} จาก {value}',
  bridgesIslandComplete: 'เกาะ {value} แถว {row} คอลัมน์ {col}: ครบแล้ว',
  bridgesIslandOver: 'เกาะ {value} แถว {row} คอลัมน์ {col}: สะพาน {count} เส้น มากเกินไป',
  bridgesIslandSelected: '{island} เลือกอยู่',
  bridgesIslandPartner: '{island} เชื่อมกับเกาะที่เลือกได้: สะพาน {bridges} จาก 2',
  bridgesIslandHinted: '{island} เน้นไว้โดยคำใบ้',
  bridgesIslandHintRing: '{island} เน้นไว้โดยคำใบ้ อยู่ในวงจุดไข่ปลา',
  bridgesAnnounceNone: 'ไม่มีสะพานระหว่างแถว {row1} คอลัมน์ {col1} กับแถว {row2} คอลัมน์ {col2}',
  bridgesAnnounceOne: 'มีสะพาน 1 เส้นระหว่างแถว {row1} คอลัมน์ {col1} กับแถว {row2} คอลัมน์ {col2}',
  bridgesAnnounceTwo: 'มีสะพาน 2 เส้นระหว่างแถว {row1} คอลัมน์ {col1} กับแถว {row2} คอลัมน์ {col2}',
  bridgesSplitNote: 'ตัวเลขครบทุกเกาะแล้ว แต่เกาะแยกเป็น {groups} กลุ่ม เชื่อมให้เป็นกลุ่มเดียว',
  bridgesHintWrong: 'สะพานระหว่างเกาะที่เน้นไว้มากเกินไป',
  bridgesHintOne: 'คู่ที่เน้นไว้ต้องมีสะพานอย่างน้อย 1 เส้น',
  bridgesHintTwo: 'คู่ที่เน้นไว้ต้องมีสะพาน 2 เส้น',
  bridgesHintOneAt: 'ลองนับที่เกาะในวงจุดไข่ปลา: คู่ที่เน้นไว้ต้องมีสะพานอย่างน้อย 1 เส้น',
  bridgesHintTwoAt: 'ลองนับที่เกาะในวงจุดไข่ปลา: คู่ที่เน้นไว้ต้องมีสะพาน 2 เส้น',
  bridgesHintNone: 'จากตรงนี้ยังไม่พบตาเดินที่แน่นอน',
  bridgesHintWhere: 'ที่เน้นไว้: แถว {row1} คอลัมน์ {col1} กับแถว {row2} คอลัมน์ {col2}',
  bridgesHintWhereRing:
    'ที่เน้นไว้: แถว {row1} คอลัมน์ {col1} กับแถว {row2} คอลัมน์ {col2} วงจุดไข่ปลา: แถว {row} คอลัมน์ {col}',
  bridgesSolvedTitle: 'เชื่อมครบแล้ว!',
  bridgesSolvedBody: 'ทุกเกาะเชื่อมกันเป็นเครือข่ายเดียว',
  bridgesHintsUsed: 'คำใบ้ที่ใช้',
  bridgesNewBestTime: 'เร็วที่สุดของคุณ',
  bridgesNewBoard: 'กระดานใหม่',
  bridgesSolvedCount: 'กระดานที่แก้ได้',
  bridgesDailySection: 'รายวัน',
  bridgesDailiesCleared: 'วันที่ทำสำเร็จ',
  bridgesAllModes: 'ทุกโหมด',
  bridgesStep1Title: 'ตัวเลขคือจำนวนสะพาน',
  bridgesStep1Body: 'แต่ละเกาะต้องมีสะพานเท่ากับตัวเลขของเกาะนั้นพอดี',
  bridgesStep2Title: 'เส้นตรง ไม่เกินสอง',
  bridgesStep2Body:
    'สะพานลากเป็นเส้นตรงแนวนอนหรือแนวตั้ง ห้ามตัดกัน และเกาะคู่เดียวกันมีสะพานได้ไม่เกิน 2 เส้น',
  bridgesStep3Title: 'เชื่อมให้ครบ',
  bridgesStep3Body:
    'แตะเกาะหนึ่ง แล้วแตะเกาะคู่ที่มีวงล้อมเพื่อเพิ่มสะพาน (แตะอีกครั้งเป็น 2 เส้น อีกครั้งเป็น 0) จนทุกเกาะเชื่อมถึงกัน',
};
