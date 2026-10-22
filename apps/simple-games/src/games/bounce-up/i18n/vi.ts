/**
 * Vietnamese catalog for Bounce Up.
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

export const vi: BounceUpMessages = {
  bounceUpName: 'Bounce Up',
  bounceUpPlay: 'Bắt đầu leo',
  bounceUpBestNote: 'Tốt nhất {score}',
  bounceUpWidth: 'Bệ đỡ',
  bounceUpWidth_normal: 'Thường',
  bounceUpWidth_wide: 'Rộng',
  bounceUpBest: 'Điểm tốt nhất',
  bounceUpTotal: 'Tổng điểm',
  bounceUpBoardLabel: 'Bàn chơi Bounce Up, {state}',
  bounceUpState_ready: 'đang chờ thao tác đầu tiên',
  bounceUpState_running: 'đang leo',
  bounceUpState_paused: 'đang tạm dừng',
  bounceUpState_over: 'lượt đã kết thúc',
  bounceUpTouchToStart: 'Vuốt trên bàn chơi hoặc nhấn ← → để bắt đầu',
  bounceUpPaused: 'Đang tạm dừng',
  bounceUpPause: 'Tạm dừng',
  bounceUpStart: 'Bắt đầu',
  bounceUpClimbAgain: 'Leo lại',
  bounceUpPad: 'Nút di chuyển',
  bounceUpMoveLeft: 'Sang trái',
  bounceUpMoveRight: 'Sang phải',
  bounceUpResultTitle: 'Đạt {score}',
  bounceUpLiveResult: 'Lượt chơi đã kết thúc. Điểm {score}.',
  bounceUpStep1Title: 'Vuốt để di chuyển',
  bounceUpStep1Body:
    'Vuốt ngón tay sang trái hoặc phải trên bàn chơi, hoặc nhấn ← →, và bạn tự bật lên mỗi khi đáp xuống một bệ đỡ.',
  bounceUpStep2Title: 'Hai mép nối liền',
  bounceUpStep2Body:
    'Ra khỏi một mép thì bạn vào lại từ mép bên kia, nên hãy dùng cả hai để lên các bệ đỡ phía trên.',
  bounceUpStep3Title: 'Độ cao là điểm',
  bounceUpStep3Body:
    'Nếu trượt khỏi các bệ đỡ và rơi xuống đáy, lượt chơi kết thúc và độ cao đã đạt là điểm của bạn.',
};
