/**
 * Turkish catalog for Overtake.
 *
 * Provenance (docs/OVERTAKE_RULES.md §12, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI (Claude) from the English source on 2026-10-21. **No native
 * speaker has read it**, nor the author; no back-translation or audit by
 * another model has been run. It is not to be treated as reviewed.
 *
 * The title (`overtakeName`) is a proper noun and stays as it is in every
 * locale.
 *
 * Terms (§12): `Sıra` for Place (never sıralama), `Temas` for Bumps (never
 * kaza), the shell's `Seviye` for Level.
 */
import type { OvertakeMessages } from './en';

export const tr: OvertakeMessages = {
  overtakeName: 'Road Weave',

  // Home
  overtakeControls: 'Kontroller',
  overtakeControlsDrag: 'Sürükle',
  overtakeControlsButtons: 'Düğmeler',

  // The game screen
  overtakeStart: 'Başla',
  overtakePause: 'Duraklat',
  overtakeTouchToStart: 'Başlamak için dokun',
  overtakePaused: 'Duraklatıldı',
  overtakePlaceNow: '4 araçtan {place}. sırada',
  overtakeBoardLabel: 'Road Weave, seviye {n}: {state}',
  overtakeState_ready: 'hazır',
  overtakeState_running: 'yarışta',
  overtakeState_paused: 'duraklatıldı',
  overtakeState_finished: 'bitti',
  overtakePad: 'Sürüş düğmeleri',
  overtakeSteerLeft: 'Sola kaydır',
  overtakeSteerRight: 'Sağa kaydır',
  overtakeSlowDown: 'Gazı kes',

  // The finish
  overtakeLiveResult: '4 araçtan {place}. sırada. Temas: {bumps}.',
  overtakeResultCleared: 'Seviye {n} geçildi',
  overtakeResultPlaced: 'Seviye {n} — {place}',
  overtakePlace: 'Sıra',
  overtakeBumps: 'Temas',

  // Quick Rules (§10)
  overtakeStep1Title: 'Şerit değiştir',
  overtakeStep1Body:
    'Şerit değiştirmek için arabayı sağa sola kaydır — gaz otomatik, hız kendiliğinden artar.',
  overtakeStep2Title: 'Gazı kes',
  overtakeStep2BodyDrag:
    'Trafik sıkışınca gazı kesmek için parmağını aşağı çek — temas seni durdurur, gazı kesmek daha hızlıdır.',
  overtakeStep2BodyHold:
    'Trafik sıkışınca gazı kesmek için ▼ düğmesini basılı tut — temas seni durdurur, gazı kesmek daha hızlıdır.',
  overtakeStep3Title: 'Önce bitir',
  overtakeStep3Body:
    'Kendi temposunda giden üç arabadan önce çizgiyi geçersen sonraki seviye açılır.',
};
