/**
 * Turkish catalog for Bounce Up.
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

export const tr: BounceUpMessages = {
  bounceUpName: 'Bounce Up',
  bounceUpPlay: 'Tırmanmaya başla',
  bounceUpBestNote: 'En iyi {score}',
  bounceUpWidth: 'Platformlar',
  bounceUpWidth_normal: 'Olağan',
  bounceUpWidth_wide: 'Geniş',
  bounceUpBest: 'En iyi skor',
  bounceUpTotal: 'Toplam skor',
  bounceUpBoardLabel: 'Bounce Up tahtası, {state}',
  bounceUpState_ready: 'ilk hareketini bekliyor',
  bounceUpState_running: 'tırmanıyor',
  bounceUpState_paused: 'duraklatıldı',
  bounceUpState_over: 'tur bitti',
  bounceUpTouchToStart: 'Başlamak için kaydır ya da ← → tuşlarına bas',
  bounceUpPaused: 'Duraklatıldı',
  bounceUpPause: 'Duraklat',
  bounceUpStart: 'Başla',
  bounceUpClimbAgain: 'Yine tırman',
  bounceUpPad: 'Hareket düğmeleri',
  bounceUpMoveLeft: 'Sola git',
  bounceUpMoveRight: 'Sağa git',
  bounceUpResultTitle: 'Ulaşılan: {score}',
  bounceUpLiveResult: 'Tur bitti. Skor {score}.',
  bounceUpStep1Title: 'Kaydırarak hareket et',
  bounceUpStep1Body:
    'Tahtada parmağını sola ya da sağa kaydır veya ← → tuşlarına bas; indiğin her platformda kendiliğinden zıplarsın.',
  bounceUpStep2Title: 'Kenarlar birleşik',
  bounceUpStep2Body:
    'Bir kenardan çıkınca öbür kenardan girersin, yukarıdaki platformlara ulaşmak için ikisini de kullan.',
  bounceUpStep3Title: 'Yükseklik skordur',
  bounceUpStep3Body:
    'Platformları kaçırıp alttan düşersen tur biter ve ulaştığın yükseklik skorun olur.',
};
