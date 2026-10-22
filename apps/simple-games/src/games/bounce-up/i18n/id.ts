/**
 * Indonesian catalog for Bounce Up.
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

export const id: BounceUpMessages = {
  bounceUpName: 'Bounce Up',
  bounceUpPlay: 'Mulai Memanjat',
  bounceUpBestNote: 'Terbaik {score}',
  bounceUpWidth: 'Pijakan',
  bounceUpWidth_normal: 'Biasa',
  bounceUpWidth_wide: 'Lebar',
  bounceUpBest: 'Skor terbaik',
  bounceUpTotal: 'Total skor',
  bounceUpBoardLabel: 'Papan Bounce Up, {state}',
  bounceUpState_ready: 'menunggu gerakan pertamamu',
  bounceUpState_running: 'sedang memanjat',
  bounceUpState_paused: 'dijeda',
  bounceUpState_over: 'permainan selesai',
  bounceUpTouchToStart: 'Geser di papan atau tekan ← → untuk mulai',
  bounceUpPaused: 'Dijeda',
  bounceUpPause: 'Jeda',
  bounceUpStart: 'Mulai',
  bounceUpClimbAgain: 'Panjat lagi',
  bounceUpPad: 'Tombol gerak',
  bounceUpMoveLeft: 'Gerak ke kiri',
  bounceUpMoveRight: 'Gerak ke kanan',
  bounceUpResultTitle: 'Sampai {score}',
  bounceUpLiveResult: 'Permainan selesai. Skor {score}.',
  bounceUpStep1Title: 'Geser untuk bergerak',
  bounceUpStep1Body:
    'Geser jari ke kiri atau kanan di papan, atau tekan ← →, dan kamu memantul sendiri di setiap pijakan tempat kamu mendarat.',
  bounceUpStep2Title: 'Kedua sisi tersambung',
  bounceUpStep2Body:
    'Keluar dari satu sisi, kamu masuk lagi dari sisi lain, jadi pakai keduanya untuk mencapai pijakan di atas.',
  bounceUpStep3Title: 'Tinggi adalah skor',
  bounceUpStep3Body:
    'Kalau meleset dari pijakan dan jatuh lewat bawah, permainan berakhir dan tinggi yang kamu capai menjadi skormu.',
};
