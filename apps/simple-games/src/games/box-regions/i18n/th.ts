/**
 * Thai catalog for Box Regions — machine translation of the English
 * source, unreviewed (docs/I18N_POLICY.md: provenance `machine`). The title
 * (`boxRegionsName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source.
 */
import type { BoxRegionsMessages } from './en';

export const th: BoxRegionsMessages = {
  boxRegionsName: 'Box Regions',
  boxRegionsChooseBoard: 'เลือกกระดาน',
  boxRegionsDifficulty_easy: 'ง่าย',
  boxRegionsDifficulty_medium: 'ปานกลาง',
  boxRegionsDifficulty_hard: 'ยาก',
  boxRegionsBoardNote: '{width}×{height}',
  boxRegionsConfirmSwitchTitle: 'แทนที่กระดานที่กำลังเล่นอยู่หรือไม่?',
  boxRegionsConfirmSwitchBody: 'เกมระดับ {current} ของคุณจะถูกแทนที่ด้วยกระดานระดับ {next} ใหม่',
  boxRegionsBoardLabel: 'กระดาน Box Regions ขนาด {width} คูณ {height}',
  boxRegionsCellAssigned: 'แถว {row} คอลัมน์ {col} กล่อง {region}',
  boxRegionsCellEmpty: 'แถว {row} คอลัมน์ {col} ยังไม่ได้จัดเข้ากล่อง',
  boxRegionsClueCount: '{count} จาก {size} ช่อง',
  boxRegionsRuleBroken: 'ผิดกฎ',
  boxRegionsKind_square: 'สี่เหลี่ยมจัตุรัส',
  boxRegionsKind_tall: 'ทรงสูง',
  boxRegionsKind_wide: 'ทรงกว้าง',
  boxRegionsKind_free: 'กล่องแบบใดก็ได้',
  boxRegionsHintWrong: 'กล่องที่เน้นไว้ไม่ตรงกับคำตอบ',
  boxRegionsHintForced: 'ช่องที่ทำเครื่องหมายไว้เป็นของกล่องของเบาะแสที่เน้นไว้เท่านั้น',
  boxRegionsHintSole: 'กล่องนี้วาดได้แบบเดียวเท่านั้น',
  boxRegionsHintCommon: 'ไม่ว่าจะวาดกล่องของเบาะแสนี้แบบไหน ก็ครอบคลุมช่องที่ทำเครื่องหมายไว้',
  boxRegionsHintNone: 'ตอนนี้ยังไม่พบตาเดินที่แน่นอน',
  boxRegionsSolvedTitle: 'แก้สำเร็จ!',
  boxRegionsSolvedBody: 'ทุกช่องอยู่ในกล่องของตัวเองแล้ว',
  boxRegionsHintsUsed: 'คำใบ้ที่ใช้',
  boxRegionsNewBestTime: 'เร็วที่สุดของคุณ',
  boxRegionsNewBoard: 'กระดานใหม่',
  boxRegionsSolvedCount: 'ปริศนาที่แก้แล้ว',
  boxRegionsDailySection: 'รายวัน',
  boxRegionsDailiesCleared: 'วันที่ทำเสร็จ',
  boxRegionsDailyBacklogHint: 'ทุกวันก่อนหน้ายังเปิดให้เล่นอยู่',
  boxRegionsStep1Title: 'แบ่งเป็นกล่อง',
  boxRegionsStep1Body: 'แบ่งกระดานเป็นสี่เหลี่ยมผืนผ้า โดยแต่ละกล่องมีเบาะแสเพียงหนึ่งเดียว',
  boxRegionsStep2Title: 'อ่านเบาะแส',
  boxRegionsStep2Body:
    'ตัวเลขคือจำนวนช่องในกล่อง ส่วนสัญลักษณ์บอกว่าเป็นจัตุรัส ทรงสูง ทรงกว้าง หรือแบบใดก็ได้',
  boxRegionsStep3Title: 'ลากจากมุมหนึ่งไปอีกมุม',
  boxRegionsStep3Body:
    'ลากจากมุมหนึ่งไปอีกมุมเพื่อวาดกล่อง แตะกล่องเพื่อลบ ติดอยู่ใช่ไหม ลองใช้คำใบ้ดู',
};
