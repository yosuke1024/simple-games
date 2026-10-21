/**
 * Thai catalog for Overtake.
 *
 * Provenance (docs/OVERTAKE_RULES.md §12, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI (Claude) from the English source on 2026-10-21. **No native
 * speaker has read it**, nor the author; no back-translation or audit by
 * another model has been run. It is not to be treated as reviewed.
 *
 * The title (`overtakeName`) is a proper noun and stays as it is in every
 * locale.
 *
 * Terms (§12): `ลำดับ` for Place (never อันดับ or การจัดอันดับ), `เฉี่ยว` for
 * Bumps (never ชน or อุบัติเหตุ), the shell's `เลเวล` for Level.
 */
import type { OvertakeMessages } from './en';

export const th: OvertakeMessages = {
  overtakeName: 'Overtake',

  // Home
  overtakeControls: 'การควบคุม',
  overtakeControlsDrag: 'ลาก',
  overtakeControlsButtons: 'ปุ่ม',

  // The game screen
  overtakeStart: 'เริ่ม',
  overtakePause: 'หยุดชั่วคราว',
  overtakeTouchToStart: 'แตะเพื่อออกตัว',
  overtakePaused: 'หยุดชั่วคราวอยู่',
  overtakePlaceNow: 'ลำดับที่ {place} จาก 4',
  overtakeBoardLabel: 'Overtake เลเวล {n}: {state}',
  overtakeState_ready: 'พร้อมออกตัว',
  overtakeState_running: 'กำลังวิ่ง',
  overtakeState_paused: 'หยุดชั่วคราวอยู่',
  overtakeState_finished: 'เข้าเส้นชัยแล้ว',
  overtakePad: 'ปุ่มขับรถ',
  overtakeSteerLeft: 'ไปทางซ้าย',
  overtakeSteerRight: 'ไปทางขวา',
  overtakeSlowDown: 'ผ่อนคันเร่ง',

  // The finish
  overtakeLiveResult: 'ลำดับที่ {place} จาก 4 เฉี่ยว {bumps} ครั้ง',
  overtakeResultCleared: 'ผ่านเลเวล {n}',
  overtakeResultPlaced: 'เลเวล {n} — {place}',
  overtakePlace: 'ลำดับ',
  overtakeBumps: 'เฉี่ยว',

  // Quick Rules (§10)
  overtakeStep1Title: 'เปลี่ยนเลน',
  overtakeStep1Body: 'ขยับรถไปซ้ายและขวาเพื่อเปลี่ยนเลน คันเร่งทำงานเอง ความเร็วจึงเพิ่มขึ้นเอง',
  overtakeStep2Title: 'ผ่อนคันเร่ง',
  overtakeStep2BodyDrag:
    'ตรงที่รถแน่น ให้ลากนิ้วลงเพื่อผ่อนคันเร่ง เฉี่ยวแล้วรถจะหยุด การผ่อนจึงไปได้เร็วกว่า',
  overtakeStep2BodyHold:
    'ตรงที่รถแน่น ให้กด ▼ ค้างไว้เพื่อผ่อนคันเร่ง เฉี่ยวแล้วรถจะหยุด การผ่อนจึงไปได้เร็วกว่า',
  overtakeStep3Title: 'เข้าเส้นชัยก่อน',
  overtakeStep3Body: 'เข้าเส้นชัยก่อนรถ 3 คันที่วิ่งตามจังหวะของตัวเอง แล้วเลเวลถัดไปจะเปิด',
};
