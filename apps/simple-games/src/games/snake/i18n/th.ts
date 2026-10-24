/**
 * Thai catalog for Snake.
 *
 * Provenance (docs/SNAKE_RULES.md §14, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI (Claude) from the English source on 2026-10-17. **No native
 * speaker has read it**, and it is not to be treated as reviewed. The title
 * (`snakeName`) is a proper noun and stays as it is in every locale.
 *
 * The `คะแนน` of the shell (`score`), `ช่อง` for a square (Nonogram),
 * `กระดาน` for the board and `ปัด` for a swipe (2048). Thai has no spaces
 * between words, so the one space in each sentence marks the clause break
 * the English em dash marks.
 */
import type { SnakeMessages } from './en';

export const th: SnakeMessages = {
  snakeName: 'Snake',

  // Home
  snakeSpeed: 'ความเร็ว',
  snakeSpeed_slow: 'ช้า',
  snakeSpeed_normal: 'ปกติ',
  snakeSpeed_fast: 'เร็ว',
  snakeResumeNote: 'คะแนน {score} · {speed}',
  snakeBestNote: 'สูงสุด {score}',

  // Game screen
  snakeTopBest: 'สูงสุด {score} · {speed}',
  snakeBoardLabel: 'กระดาน Snake ขนาด {size} คูณ {size}: {state}',
  snakeStateReady: 'พร้อมเริ่ม',
  snakeStateRunning: 'กำลังเคลื่อนที่',
  snakeStatePaused: 'หยุดชั่วคราวอยู่',
  snakeStateOver: 'จบเกม',
  snakeStateCleared: 'เต็มกระดาน',
  snakeControls: 'ปุ่มควบคุม',
  snakeDir_up: 'ขึ้น',
  snakeDir_down: 'ลง',
  snakeDir_left: 'ซ้าย',
  snakeDir_right: 'ขวา',
  snakeStart: 'เริ่ม',
  snakePause: 'หยุดชั่วคราว',
  snakePaused: 'หยุดชั่วคราวอยู่',
  snakeNextTurn: 'ทิศถัดไป: {direction}',

  // Screen reader announcements (polite; never one per tick)
  snakeLiveStarted: 'เริ่มแล้ว',
  snakeLivePaused: 'หยุดชั่วคราว คะแนน {score}',
  snakeLiveResumed: 'เล่นต่อแล้ว',
  snakeLiveScore: 'คะแนน {score}',
  snakeLiveWall: 'จบเกม: งูชนกำแพง คะแนน {score}',
  snakeLiveSelf: 'จบเกม: งูชนตัวเอง คะแนน {score}',
  snakeLiveCleared: 'เต็มกระดานแล้ว คะแนน {score}',
  snakeLiveNextCleared: 'ยกเลิกทิศถัดไปแล้ว',

  // Result
  snakeOverTitle: 'จบเกม',
  snakeClearedTitle: 'เต็มกระดานแล้ว',
  snakeOverWall: 'งูชนกำแพง',
  snakeOverSelf: 'งูชนตัวเอง',
  snakeClearedBody: 'งูเต็มทุกช่องแล้ว',
  snakeLength: 'ความยาว',
  snakeNewBest: 'สถิติใหม่ ({speed})',
  snakeBestAt: 'สูงสุด ({speed}): {score}',

  // Statistics
  snakeBestScore: 'คะแนนสูงสุด',
  snakeClears: 'จำนวนครั้งที่เต็มกระดาน',

  // Quick Rules
  snakeStep1Title: 'เลี้ยว',
  snakeStep1Body: 'ปัด แตะลูกศร หรือกดปุ่มลูกศรเพื่อเลี้ยว งูจะเคลื่อนไปทีละช่องไม่หยุด',
  snakeStep2Title: 'กิน',
  snakeStep2Body: 'กินอาหารหนึ่งชิ้น งูจะยาวขึ้นหนึ่งช่องและได้หนึ่งคะแนน',
  snakeStep3Title: 'อย่าชน',
  snakeStep3Body: 'ชนกำแพงหรือตัวเองเมื่อไรก็จบ เติมงูให้เต็มกระดานเพื่อเคลียร์',
  snakeFigureTurn: 'งูที่กำลังจะเลี้ยวขึ้นไปหาอาหาร',
  snakeFigureEat: 'งูที่อยู่ห่างอาหารหนึ่งช่อง',
  snakeFigureCrash: 'งูที่ชนกำแพง',
};
