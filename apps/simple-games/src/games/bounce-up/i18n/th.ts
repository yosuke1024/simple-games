/**
 * Thai catalog for Bounce Up.
 *
 * Provenance (docs/BOUNCE_UP_RULES.md §8, docs/I18N_POLICY.md「来歴」): written by
 * AI (Claude) from the English source on 2026-10-22 and **not yet read by
 * anyone** — neither the author nor a native speaker. It is not to be
 * treated as reviewed.
 *
 * The title (`bounceUpName`) is a proper noun and stays as it is in every
 * locale. Terms follow §8's glossary: platform, score, best, total.
 */
import type { BounceUpMessages } from './en';

export const th: BounceUpMessages = {
  bounceUpName: 'Bounce Up',
  bounceUpPlay: 'เริ่มปีน',
  bounceUpBestNote: 'ดีที่สุด {score}',
  bounceUpWidth: 'ฐานเหยียบ',
  bounceUpWidth_normal: 'ปกติ',
  bounceUpWidth_wide: 'กว้าง',
  bounceUpBest: 'คะแนนดีที่สุด',
  bounceUpTotal: 'คะแนนรวม',
  bounceUpBoardLabel: 'กระดาน Bounce Up, {state}',
  bounceUpState_ready: 'รอการเคลื่อนไหวแรก',
  bounceUpState_running: 'กำลังปีน',
  bounceUpState_paused: 'หยุดชั่วคราว',
  bounceUpState_over: 'จบรอบแล้ว',
  bounceUpTouchToStart: 'ปัดบนกระดานหรือกด ← → เพื่อเริ่ม',
  bounceUpPaused: 'หยุดชั่วคราว',
  bounceUpPause: 'หยุด',
  bounceUpStart: 'เริ่ม',
  bounceUpClimbAgain: 'ปีนอีกครั้ง',
  bounceUpPad: 'ปุ่มเคลื่อนที่',
  bounceUpMoveLeft: 'ไปทางซ้าย',
  bounceUpMoveRight: 'ไปทางขวา',
  bounceUpResultTitle: 'ไปถึง {score}',
  bounceUpLiveResult: 'จบรอบแล้ว คะแนน {score}',
  bounceUpStep1Title: 'ปัดเพื่อเคลื่อนที่',
  bounceUpStep1Body:
    'ปัดนิ้วไปซ้ายหรือขวาบนกระดาน หรือกด ← → แล้วตัวละครจะเด้งขึ้นเองทุกครั้งที่ลงบนฐานเหยียบ',
  bounceUpStep2Title: 'ขอบซ้ายขวาเชื่อมกัน',
  bounceUpStep2Body:
    'ออกทางขอบด้านหนึ่งแล้วจะกลับเข้ามาทางอีกด้าน ใช้ทั้งสองด้านเพื่อขึ้นไปยังฐานเหยียบข้างบน',
  bounceUpStep3Title: 'ความสูงคือคะแนน',
  bounceUpStep3Body:
    'ถ้าพลาดฐานเหยียบจนตกลงไปด้านล่าง รอบนั้นจะจบ และความสูงที่ไปถึงคือคะแนนของคุณ',
};
