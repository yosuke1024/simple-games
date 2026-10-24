/**
 * German catalog for Overtake.
 *
 * Provenance (docs/OVERTAKE_RULES.md §12, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI (Claude) from the English source on 2026-10-21. **No native
 * speaker has read it**, nor the author; no back-translation or audit by
 * another model has been run. It is not to be treated as reviewed.
 *
 * The title (`overtakeName`) is a proper noun and stays as it is in every
 * locale.
 *
 * Terms (§12): `Platz` for Place (never Rang or Rangliste), `Rempler` for Bumps
 * (never Unfall), the informal `du` of the shell, `Starten` (the shell's
 * `Start` is the way home in German). A no-break space keeps each dash off
 * the start of a line.
 */
import type { OvertakeMessages } from './en';

export const de: OvertakeMessages = {
  overtakeName: 'Overtake',

  // Home
  overtakeControls: 'Steuerung',
  overtakeControlsDrag: 'Ziehen',
  overtakeControlsButtons: 'Tasten',

  // The game screen
  overtakeStart: 'Starten',
  overtakePause: 'Pause',
  overtakeTouchToStart: 'Tippen zum Starten',
  overtakePaused: 'Pausiert',
  overtakePlaceNow: 'Platz {place} von 4',
  overtakeBoardLabel: 'Overtake, Level {n}: {state}',
  overtakeState_ready: 'bereit',
  overtakeState_running: 'unterwegs',
  overtakeState_paused: 'pausiert',
  overtakeState_finished: 'im Ziel',
  overtakePad: 'Fahrtasten',
  overtakeSteerLeft: 'Nach links lenken',
  overtakeSteerRight: 'Nach rechts lenken',
  overtakeSlowDown: 'Gas wegnehmen',

  // The finish
  overtakeLiveResult: 'Platz {place} von 4. Rempler: {bumps}.',
  overtakeResultCleared: 'Level {n} geschafft',
  overtakeResultPlaced: 'Level {n}\u00a0– {place}',
  overtakePlace: 'Platz',
  overtakeBumps: 'Rempler',

  // Quick Rules (§10)
  overtakeStep1Title: 'Spur wechseln',
  overtakeStep1Body:
    'Bewege das Auto nach links und rechts, um die Spur zu wechseln\u00a0– Gas gibt es automatisch, das Tempo steigt von selbst.',
  overtakeStep2Title: 'Gas wegnehmen',
  overtakeStep2BodyDrag:
    'Wo es eng wird, zieh den Finger nach unten, um Gas wegzunehmen\u00a0– ein Rempler stoppt dich, also ist Gas wegnehmen schneller.',
  overtakeStep2BodyHold:
    'Wo es eng wird, halte ▼ gedrückt, um Gas wegzunehmen\u00a0– ein Rempler stoppt dich, also ist Gas wegnehmen schneller.',
  overtakeStep3Title: 'Als Erster ins Ziel',
  overtakeStep3Body:
    'Komm vor den drei Autos ins Ziel, die ihr eigenes Tempo fahren, und das nächste Level öffnet sich.',
};
