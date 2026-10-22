/**
 * Thai catalog for Gem Swap.
 *
 * Provenance (docs/GEM_SWAP_RULES.md §11, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI from the English source on 2026-10-22. **No native speaker
 * has read it, and neither has the author**; it is not to be treated as
 * reviewed. The title (`gemSwapName`) is a proper noun and stays as it is.
 *
 * Terms: `สลับ` for a swap, `แถว` for a line of three, `รอบ` for a round, `อัญมณี` for a gem,
 * `การหายต่อเนื่อง` for the cascade, `สถิติ` / `สูงสุด` for a best (Snake), `คะแนน` for the
 * score (shell `score`). The stuck ending is a fact about the board, never `แพ้` or `จบเกม`.
 */
import type { GemSwapMessages } from './en';

export const th: GemSwapMessages = {
  gemSwapName: 'Gem Swap',
  gemSwapKinds: 'อัญมณี',
  gemSwapKinds_5: '5 · ง่าย',
  gemSwapKinds_6: '6 · ปกติ',
  gemSwapKindsCount: '{count} แบบ',
  gemSwapResumeNote: 'คะแนน {score} · {kinds}',
  gemSwapBestNote: 'สูงสุด {score}',
  gemSwapBestFor: 'สูงสุด, {kinds}',
  gemSwapSwapsLeft: 'สลับได้อีก {count} ครั้ง',
  gemSwapBoardLabel: 'กระดานอัญมณี {size} × {size}',
  gemSwapCell: 'แถว {row} คอลัมน์ {col}, {gem}',
  gemSwapCellSelected: 'แถว {row} คอลัมน์ {col}, {gem}, เลือกอยู่',
  gemSwapGem_hexagon: 'หกเหลี่ยม',
  gemSwapGem_octagon: 'แปดเหลี่ยม',
  gemSwapGem_pear: 'หยดน้ำ',
  gemSwapGem_marquise: 'ทรงเรือ',
  gemSwapGem_shield: 'โล่',
  gemSwapGem_heart: 'หัวใจ',
  gemSwapNewBoard: 'กระดานใหม่',
  gemSwapLiveMove: 'หายไป {count} · สลับได้อีก {left} ครั้ง',
  gemSwapLiveInvalid: 'สองอันนี้สลับกันไม่ได้',
  gemSwapLiveUndo: 'ยกเลิกการสลับแล้ว · สลับได้อีก {left} ครั้ง',
  gemSwapResultTitle: 'จบรอบ',
  gemSwapEnd_swaps: 'สลับครบ 30 ครั้งแล้ว',
  gemSwapEnd_stuck: 'ไม่มีการสลับที่ทำให้เรียงสามได้อีกแล้ว',
  gemSwapEnd_cap: 'การหายต่อเนื่องถึงขีดจำกัด 64 ขั้นแล้ว',
  gemSwapNotCounted: 'รอบที่หยุดที่ขีดจำกัดจะไม่นับเป็นสถิติ',
  gemSwapNewBest: 'สถิติใหม่ ({kinds})',
  gemSwapBestWith: 'สูงสุด ({kinds}): {score}',
  gemSwapStep1Title: 'สลับ',
  gemSwapStep1Body: 'สลับอัญมณีสองอันที่อยู่ติดกันให้รูปทรงเดียวกันเรียงเป็นแถวตั้งแต่สามอันขึ้นไป',
  gemSwapStep2Title: 'หายไป',
  gemSwapStep2Body: 'แถวจะหายไป อัญมณีใหม่ตกลงมาจากด้านบน และแถวที่เกิดขึ้นใหม่ก็หายไปด้วย',
  gemSwapStep3Title: 'คะแนน',
  gemSwapStep3Body: 'หนึ่งรอบมีการสลับ 30 ครั้ง และอัญมณีที่หายไปแต่ละอันได้หนึ่งคะแนน',
  gemSwapFigureSwap: 'อัญมณีสองอันที่อยู่ติดกันกำลังจะสลับเพื่อให้หกเหลี่ยมสามอันเรียงกัน',
  gemSwapFigureClear: 'แถวหนึ่งหายไปแล้ว และอัญมณีด้านบนตกลงมาแทนที่',
  gemSwapFigureRound: 'คะแนน 42 และแถบที่เหลือการสลับ 18 จาก 30 ครั้ง',
};
