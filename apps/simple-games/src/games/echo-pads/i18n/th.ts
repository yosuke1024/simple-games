/**
 * Echo Pads — the ไทย catalog. Provenance (docs/ECHO_PADS_RULES.md §14):
 * `machine` — written by an AI from the English source on 2026-10-22; nobody
 * has read it, native speaker or author. The title (`echoPadsName`) stays
 * "Echo Pads".
 *
 * Terms (§14's glossary): แป้น (pad), ลำดับ (sequence), ความยาว (length), เล่น / ฟังอีกครั้ง / หยุด, จังหวะ: ช้า / ปกติ / เร็ว.
 */
import type { EchoPadsMessages } from './en';

export const th: EchoPadsMessages = {
  echoPadsName: 'Echo Pads',
  echoPadsTier_4: '4 แป้น',
  echoPadsTier_6: '6 แป้น',
  echoPadsLength: 'ความยาว {n}',
  echoPadsLevelDetail: '{tier} · ความยาว {length}',
  echoPadsPace: 'จังหวะ',
  echoPadsPace_calm: 'ช้า',
  echoPadsPace_normal: 'ปกติ',
  echoPadsPace_quick: 'เร็ว',
  echoPadsPlay: 'เล่น',
  echoPadsListenAgain: 'ฟังอีกครั้ง',
  echoPadsStop: 'หยุด',
  echoPadsRound: 'ความยาว {k} จาก {target}',
  echoPadsStatusIdle: 'กดเล่นเพื่อฟัง {k} แป้น',
  echoPadsStatusPlaying: 'กำลังเล่น {k} แป้น…',
  echoPadsStatusYourTurn: 'ตาคุณ: แตะ {k} แป้นตามลำดับเดิม',
  echoPadsStatusAgain: 'แตะทั้ง {k} แป้นอีกครั้งตั้งแต่แป้นแรก',
  echoPadsStatusReview: 'กำลังเล่น {k} แป้นของรอบนี้อีกครั้ง…',
  echoPadsMark_circle: 'วงกลม',
  echoPadsMark_triangle: 'สามเหลี่ยม',
  echoPadsMark_square: 'สี่เหลี่ยม',
  echoPadsMark_star: 'ดาว',
  echoPadsMark_diamond: 'ข้าวหลามตัด',
  echoPadsMark_cross: 'กากบาท',
  echoPadsPos_topLeft: 'ซ้ายบน',
  echoPadsPos_topMiddle: 'กลางบน',
  echoPadsPos_topRight: 'ขวาบน',
  echoPadsPos_bottomLeft: 'ซ้ายล่าง',
  echoPadsPos_bottomMiddle: 'กลางล่าง',
  echoPadsPos_bottomRight: 'ขวาล่าง',
  echoPadsPadLabel: '{mark}, {position}',
  echoPadsPadsLabel: 'แป้น',
  echoPadsExpectedLabel: '{pad} (แป้นที่ต้องกดถัดไป)',
  echoPadsMissTitle: 'รอบนี้จบที่ความยาว {k}',
  echoPadsMissBody: 'แป้นที่ {index} จาก {k} คือ {pad}',
  echoPadsResultTitle: 'ทวนครบทั้ง {n}',
  echoPadsLongest: 'ทวนได้ยาวที่สุด',
  echoPadsLongestNone: 'ไม่มี',
  echoPadsReplays: 'ฟังอีกครั้ง',
  echoPadsPacesHeard: 'จังหวะ',
  echoPadsNewSequence: 'ลำดับใหม่',
  echoPadsLevelCell: '{level}, {detail}',
  echoPadsLevelCellCleared: '{level}, {detail}, ผ่านแล้ว',
  echoPadsReplaceTitle: 'แทนที่รอบที่เล่นค้างอยู่ไหม',
  echoPadsReplaceBody: 'รอบที่ {current} จะถูกแทนที่ด้วยรอบใหม่ที่ {next}',
  echoPadsStatStarted: 'รอบที่เริ่ม',
  echoPadsStatCleared: 'ผ่าน',
  echoPadsStatMissed: 'จบเพราะกดผิด',
  echoPadsStatLevels: 'ด่านที่ผ่าน',
  echoPadsStatDays: 'วันที่ทำสำเร็จ',
  echoPadsStep1Title: 'ฟัง',
  echoPadsStep1Body:
    'กด ▶ แล้วแป้นจะสว่างและมีเสียงทีละแป้น — จำลำดับไว้ (ก่อนแตะครั้งแรก ฟังซ้ำได้กี่ครั้งก็ได้)',
  echoPadsStep2Title: 'ทวน',
  echoPadsStep2Body: 'จากนั้นแตะแป้นตามลำดับเดิม',
  echoPadsStep3Title: 'ยาวขึ้น',
  echoPadsStep3Body: 'ทุกครั้งที่ทวนได้ ลำดับจะยาวขึ้นหนึ่ง — ไม่มีการจำกัดเวลา',
};
