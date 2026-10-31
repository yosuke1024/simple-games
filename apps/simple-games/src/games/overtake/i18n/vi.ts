/**
 * Vietnamese catalog for Overtake.
 *
 * Provenance (docs/OVERTAKE_RULES.md §12, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI (Claude) from the English source on 2026-10-21. **No native
 * speaker has read it**, nor the author; no back-translation or audit by
 * another model has been run. It is not to be treated as reviewed.
 *
 * The title (`overtakeName`) is a proper noun and stays as it is in every
 * locale.
 *
 * Terms (§12): `Vị trí` for Place (never hạng or bảng xếp hạng), `Chạm xe`
 * for Bumps (never tai nạn), the shell's `Cấp` for Level.
 */
import type { OvertakeMessages } from './en';

export const vi: OvertakeMessages = {
  overtakeName: 'Road Weave',

  // Home
  overtakeControls: 'Điều khiển',
  overtakeControlsDrag: 'Kéo',
  overtakeControlsButtons: 'Nút',

  // The game screen
  overtakeStart: 'Bắt đầu',
  overtakePause: 'Tạm dừng',
  overtakeTouchToStart: 'Chạm để xuất phát',
  overtakePaused: 'Đang tạm dừng',
  overtakePlaceNow: 'Vị trí {place} trên 4',
  overtakeBoardLabel: 'Road Weave, cấp {n}: {state}',
  overtakeState_ready: 'sẵn sàng',
  overtakeState_running: 'đang chạy',
  overtakeState_paused: 'đang tạm dừng',
  overtakeState_finished: 'đã về đích',
  overtakePad: 'Nút lái xe',
  overtakeSteerLeft: 'Sang trái',
  overtakeSteerRight: 'Sang phải',
  overtakeSlowDown: 'Giảm ga',

  // The finish
  overtakeLiveResult: 'Vị trí {place} trên 4. Chạm xe: {bumps}.',
  overtakeResultCleared: 'Đã qua cấp {n}',
  overtakeResultPlaced: 'Cấp {n} — {place}',
  overtakePlace: 'Vị trí',
  overtakeBumps: 'Chạm xe',

  // Quick Rules (§10)
  overtakeStep1Title: 'Đổi làn',
  overtakeStep1Body:
    'Di chuyển xe sang trái và phải để đổi làn — ga là tự động nên xe tự tăng tốc.',
  overtakeStep2Title: 'Giảm ga',
  overtakeStep2BodyDrag:
    'Chỗ xe đông, kéo ngón tay xuống để giảm ga — chạm xe sẽ khiến bạn dừng lại, nên giảm ga lại nhanh hơn.',
  overtakeStep2BodyHold:
    'Chỗ xe đông, giữ ▼ để giảm ga — chạm xe sẽ khiến bạn dừng lại, nên giảm ga lại nhanh hơn.',
  overtakeStep3Title: 'Về đích trước',
  overtakeStep3Body: 'Về đích trước ba xe đang chạy theo nhịp riêng, và cấp tiếp theo sẽ mở.',
};
