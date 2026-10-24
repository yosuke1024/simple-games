/**
 * French catalog for Overtake.
 *
 * Provenance (docs/OVERTAKE_RULES.md §12, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI (Claude) from the English source on 2026-10-21. **No native
 * speaker has read it**, nor the author; no back-translation or audit by
 * another model has been run. It is not to be treated as reviewed.
 *
 * The title (`overtakeName`) is a proper noun and stays as it is in every
 * locale.
 *
 * Terms (§12): `Position` for Place (never classement), `Accrochages` for Bumps
 * (never accident), `vous` as in the shell. A no-break space sits before
 * each colon and dash, as French typesetting wants.
 */
import type { OvertakeMessages } from './en';

export const fr: OvertakeMessages = {
  overtakeName: 'Overtake',

  // Home
  overtakeControls: 'Commandes',
  overtakeControlsDrag: 'Glisser',
  overtakeControlsButtons: 'Boutons',

  // The game screen
  overtakeStart: 'Démarrer',
  overtakePause: 'Pause',
  overtakeTouchToStart: 'Touchez pour partir',
  overtakePaused: 'En pause',
  overtakePlaceNow: 'Position {place} sur 4',
  overtakeBoardLabel: 'Overtake, niveau {n}\u00a0: {state}',
  overtakeState_ready: 'prêt',
  overtakeState_running: 'en course',
  overtakeState_paused: 'en pause',
  overtakeState_finished: 'arrivé',
  overtakePad: 'Boutons de conduite',
  overtakeSteerLeft: 'Aller à gauche',
  overtakeSteerRight: 'Aller à droite',
  overtakeSlowDown: 'Lever le pied',

  // The finish
  overtakeLiveResult: 'Position {place} sur 4. Accrochages\u00a0: {bumps}.',
  overtakeResultCleared: 'Niveau {n} réussi',
  overtakeResultPlaced: 'Niveau {n}\u00a0— {place}',
  overtakePlace: 'Position',
  overtakeBumps: 'Accrochages',

  // Quick Rules (§10)
  overtakeStep1Title: 'Changer de voie',
  overtakeStep1Body:
    'Déplacez la voiture à gauche et à droite pour changer de voie\u00a0— l’accélérateur est automatique, la vitesse monte toute seule.',
  overtakeStep2Title: 'Lever le pied',
  overtakeStep2BodyDrag:
    'Là où la circulation est dense, tirez le doigt vers le bas pour lever le pied\u00a0— un accrochage vous arrête, alors lever le pied va plus vite.',
  overtakeStep2BodyHold:
    'Là où la circulation est dense, maintenez ▼ pour lever le pied\u00a0— un accrochage vous arrête, alors lever le pied va plus vite.',
  overtakeStep3Title: 'Arriver premier',
  overtakeStep3Body:
    'Franchissez la ligne avant les trois voitures qui roulent à leur propre rythme, et le niveau suivant s’ouvre.',
};
