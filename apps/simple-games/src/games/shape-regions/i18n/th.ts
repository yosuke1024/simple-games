/**
 * Thai catalog for Shape Regions (docs/I18N_POLICY.md: provenance
 * `machine`). The title (`shapeRegionsName`) is a proper noun and stays
 * as-is in every locale; placeholder names match the English source.
 */
import type { ShapeRegionsMessages } from './en';

export const th: ShapeRegionsMessages = {
  shapeRegionsName: 'Shape Regions',
  shapeRegionsChooseBoard: 'เลือกกระดาน',
  shapeRegionsDifficulty_easy: 'ง่าย',
  shapeRegionsDifficulty_medium: 'ปานกลาง',
  shapeRegionsDifficulty_hard: 'ยาก',
  shapeRegionsBoardNote: '{width}×{height}',
  shapeRegionsConfirmSwitchTitle: 'แทนที่กระดานที่กำลังเล่นอยู่?',
  shapeRegionsConfirmSwitchBody: 'เกม{current}ของคุณจะถูกแทนที่ด้วยกระดาน{next}ใหม่',
  shapeRegionsBoardLabel: 'กระดาน Shape Regions ขนาด {width} คูณ {height}',
  shapeRegionsCellAssigned: 'แถว {row} คอลัมน์ {col} รูปทรง {region}',
  shapeRegionsCellEmpty: 'แถว {row} คอลัมน์ {col} ยังว่าง',
  shapeRegionsClueCount: '{count} จาก {size} ช่อง',
  shapeRegionsRuleBroken: 'ผิดกติกา',
  shapeRegionsShape_line: 'เส้นตรง',
  shapeRegionsShape_block: 'สี่เหลี่ยม',
  shapeRegionsShape_corner: 'มุมฉาก',
  shapeRegionsShape_tee: 'รูปตัว T',
  shapeRegionsShape_step: 'ขั้นบันได',
  shapeRegionsHintWrong: 'รูปทรงที่เน้นไม่ตรงกับคำตอบ',
  shapeRegionsHintForced: 'ช่องที่ทำเครื่องหมายเป็นของรูปทรงที่เน้นได้เท่านั้น',
  shapeRegionsHintSole: 'รูปทรงที่เน้นวางได้เพียงแบบเดียว',
  shapeRegionsHintCommon: 'ไม่ว่ารูปทรงที่เน้นจะวางแบบใด ก็ต้องมีช่องที่ทำเครื่องหมาย',
  shapeRegionsHintNone: 'ยังไม่พบตาเดินที่แน่นอนตอนนี้',
  shapeRegionsSolvedTitle: 'สำเร็จ!',
  shapeRegionsSolvedBody: 'ทุกช่องอยู่ในรูปทรงของมันแล้ว',
  shapeRegionsHintsUsed: 'ใช้คำใบ้',
  shapeRegionsNewBestTime: 'เร็วที่สุดของคุณ',
  shapeRegionsNewBoard: 'กระดานใหม่',
  shapeRegionsSolvedCount: 'ปริศนาที่แก้ได้',
  shapeRegionsDailySection: 'รายวัน',
  shapeRegionsDailiesCleared: 'วันที่ทำสำเร็จ',
  shapeRegionsStep1Title: 'ตัวเลขและสัญลักษณ์',
  shapeRegionsStep1Body: 'ตัวเลขคือจำนวนช่องของรูปทรง สัญลักษณ์คือรูปร่างของมัน',
  shapeRegionsStep2Title: 'ขยายจากคำใบ้',
  shapeRegionsStep2Body: 'ลากจากคำใบ้ผ่านช่องข้างเคียงเพื่อขยายรูปทรง',
  shapeRegionsStep3Title: 'เติมกระดานให้เต็ม',
  shapeRegionsStep3Body: 'เมื่อเสร็จ ทุกช่องจะอยู่ในรูปทรงใดรูปทรงหนึ่ง แตะช่องเพื่อเอาออก',
};
