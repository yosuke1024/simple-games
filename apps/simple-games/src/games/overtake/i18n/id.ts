/**
 * Indonesian catalog for Overtake.
 *
 * Provenance (docs/OVERTAKE_RULES.md §12, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI (Claude) from the English source on 2026-10-21. **No native
 * speaker has read it**, nor the author; no back-translation or audit by
 * another model has been run. It is not to be treated as reviewed.
 *
 * The title (`overtakeName`) is a proper noun and stays as it is in every
 * locale.
 *
 * Terms (§12): `Posisi` for Place (never peringkat), `Senggolan` for Bumps
 * (never tabrakan).
 */
import type { OvertakeMessages } from './en';

export const id: OvertakeMessages = {
  overtakeName: 'Road Weave',

  // Home
  overtakeControls: 'Kontrol',
  overtakeControlsDrag: 'Geser',
  overtakeControlsButtons: 'Tombol',

  // The game screen
  overtakeStart: 'Mulai',
  overtakePause: 'Jeda',
  overtakeTouchToStart: 'Sentuh untuk mulai',
  overtakePaused: 'Dijeda',
  overtakePlaceNow: 'Posisi {place} dari 4',
  overtakeBoardLabel: 'Road Weave, level {n}: {state}',
  overtakeState_ready: 'siap',
  overtakeState_running: 'melaju',
  overtakeState_paused: 'dijeda',
  overtakeState_finished: 'selesai',
  overtakePad: 'Tombol mengemudi',
  overtakeSteerLeft: 'Belok kiri',
  overtakeSteerRight: 'Belok kanan',
  overtakeSlowDown: 'Kurangi gas',

  // The finish
  overtakeLiveResult: 'Posisi {place} dari 4. Senggolan: {bumps}.',
  overtakeResultCleared: 'Level {n} selesai',
  overtakeResultPlaced: 'Level {n} — {place}',
  overtakePlace: 'Posisi',
  overtakeBumps: 'Senggolan',

  // Quick Rules (§10)
  overtakeStep1Title: 'Pindah lajur',
  overtakeStep1Body:
    'Gerakkan mobil ke kiri dan kanan untuk pindah lajur — gasnya otomatis, jadi kecepatan naik sendiri.',
  overtakeStep2Title: 'Kurangi gas',
  overtakeStep2BodyDrag:
    'Saat lalu lintas padat, tarik jari ke bawah untuk mengurangi gas — senggolan membuatmu berhenti, jadi mengurangi gas lebih cepat.',
  overtakeStep2BodyHold:
    'Saat lalu lintas padat, tahan ▼ untuk mengurangi gas — senggolan membuatmu berhenti, jadi mengurangi gas lebih cepat.',
  overtakeStep3Title: 'Sampai duluan',
  overtakeStep3Body:
    'Lewati garis finis sebelum tiga mobil yang melaju dengan kecepatannya sendiri, dan level berikutnya terbuka.',
};
