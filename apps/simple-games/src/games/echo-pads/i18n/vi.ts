/**
 * Echo Pads — the Tiếng Việt catalog. Provenance (docs/ECHO_PADS_RULES.md §14):
 * `machine` — written by an AI from the English source on 2026-10-22; nobody
 * has read it, native speaker or author. The title (`echoPadsName`) stays
 * "Echo Pads".
 *
 * Terms (§14's glossary): ô (pad), chuỗi (sequence), độ dài (length), Phát / Nghe lại / Dừng, Nhịp: Chậm rãi / Vừa / Nhanh.
 */
import type { EchoPadsMessages } from './en';

export const vi: EchoPadsMessages = {
  echoPadsName: 'Echo Pads',
  echoPadsTier_4: '4 ô',
  echoPadsTier_6: '6 ô',
  echoPadsLength: 'Độ dài {n}',
  echoPadsLevelDetail: '{tier} · độ dài {length}',
  echoPadsPace: 'Nhịp',
  echoPadsPace_calm: 'Chậm rãi',
  echoPadsPace_normal: 'Vừa',
  echoPadsPace_quick: 'Nhanh',
  echoPadsPlay: 'Phát',
  echoPadsListenAgain: 'Nghe lại',
  echoPadsStop: 'Dừng',
  echoPadsRound: 'Độ dài {k} trên {target}',
  echoPadsStatusIdle: 'Nhấn Phát để nghe {k} ô.',
  echoPadsStatusPlaying: 'Đang phát {k} ô…',
  echoPadsStatusYourTurn: 'Đến lượt bạn: chạm {k} ô theo đúng thứ tự.',
  echoPadsStatusAgain: 'Chạm lại cả {k} ô, bắt đầu từ ô đầu tiên.',
  echoPadsStatusReview: 'Đang phát lại {k} ô của vòng này…',
  echoPadsMark_circle: 'Hình tròn',
  echoPadsMark_triangle: 'Tam giác',
  echoPadsMark_square: 'Hình vuông',
  echoPadsMark_star: 'Ngôi sao',
  echoPadsMark_diamond: 'Hình thoi',
  echoPadsMark_cross: 'Dấu cộng',
  echoPadsPos_topLeft: 'trên bên trái',
  echoPadsPos_topMiddle: 'trên ở giữa',
  echoPadsPos_topRight: 'trên bên phải',
  echoPadsPos_bottomLeft: 'dưới bên trái',
  echoPadsPos_bottomMiddle: 'dưới ở giữa',
  echoPadsPos_bottomRight: 'dưới bên phải',
  echoPadsPadLabel: '{mark}, {position}',
  echoPadsPadsLabel: 'Các ô',
  echoPadsExpectedLabel: '{pad} (ô đến tiếp theo)',
  echoPadsMissTitle: 'Lượt chơi kết thúc ở độ dài {k}',
  echoPadsMissBody: 'Ô thứ {index} trong {k} ô là: {pad}.',
  echoPadsResultTitle: 'Đã lặp lại đủ {n} ô',
  echoPadsLongest: 'Dài nhất đã lặp lại',
  echoPadsLongestNone: 'Không có',
  echoPadsReplays: 'Số lần nghe lại',
  echoPadsPacesHeard: 'Nhịp',
  echoPadsNewSequence: 'Chuỗi mới',
  echoPadsLevelCell: '{level}, {detail}',
  echoPadsLevelCellCleared: '{level}, {detail}, đã qua',
  echoPadsReplaceTitle: 'Thay lượt chơi đang dở?',
  echoPadsReplaceBody: 'Lượt chơi ở {current} sẽ được thay bằng một lượt mới ở {next}.',
  echoPadsStatStarted: 'Lượt đã bắt đầu',
  echoPadsStatCleared: 'Đã qua',
  echoPadsStatMissed: 'Kết thúc do chạm sai',
  echoPadsStatLevels: 'Màn đã qua',
  echoPadsStatDays: 'Ngày đã hoàn thành',
  echoPadsStep1Title: 'Nghe',
  echoPadsStep1Body:
    'Nhấn ▶, các ô lần lượt sáng lên và phát âm thanh — hãy nhớ thứ tự (trước lần chạm đầu tiên, bạn có thể nghe lại bao nhiêu lần tùy thích).',
  echoPadsStep2Title: 'Lặp lại',
  echoPadsStep2Body: 'Sau đó chạm các ô theo đúng thứ tự.',
  echoPadsStep3Title: 'Dài thêm',
  echoPadsStep3Body: 'Mỗi lần bạn lặp lại đúng, thứ tự dài thêm một — không giới hạn thời gian.',
};
