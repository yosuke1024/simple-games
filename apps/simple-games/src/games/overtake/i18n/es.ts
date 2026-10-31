/**
 * Spanish catalog for Overtake.
 *
 * Provenance (docs/OVERTAKE_RULES.md §12, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI (Claude) from the English source on 2026-10-21. **No native
 * speaker has read it**, nor the author; no back-translation or audit by
 * another model has been run. It is not to be treated as reviewed.
 *
 * The title (`overtakeName`) is a proper noun and stays as it is in every
 * locale.
 *
 * Terms (§12): `Puesto` for Place (never clasificación or ranking), `Roces`
 * for Bumps (never choque; not toques, which this collection uses for taps —
 * Schulte Table's `Toques erróneos`), the informal `tú` of the shell, and the
 * Latin American `auto` and `mantén presionado` (the policy's neutral Spanish).
 */
import type { OvertakeMessages } from './en';

export const es: OvertakeMessages = {
  overtakeName: 'Road Weave',

  // Home
  overtakeControls: 'Controles',
  overtakeControlsDrag: 'Arrastrar',
  overtakeControlsButtons: 'Botones',

  // The game screen
  overtakeStart: 'Empezar',
  overtakePause: 'Pausa',
  overtakeTouchToStart: 'Toca para empezar',
  overtakePaused: 'En pausa',
  overtakePlaceNow: 'Puesto {place} de 4',
  overtakeBoardLabel: 'Road Weave, nivel {n}: {state}',
  overtakeState_ready: 'listo',
  overtakeState_running: 'en carrera',
  overtakeState_paused: 'en pausa',
  overtakeState_finished: 'en la meta',
  overtakePad: 'Botones de conducción',
  overtakeSteerLeft: 'Girar a la izquierda',
  overtakeSteerRight: 'Girar a la derecha',
  overtakeSlowDown: 'Aflojar',

  // The finish
  overtakeLiveResult: 'Puesto {place} de 4. Roces: {bumps}.',
  overtakeResultCleared: 'Nivel {n} superado',
  overtakeResultPlaced: 'Nivel {n} — {place}',
  overtakePlace: 'Puesto',
  overtakeBumps: 'Roces',

  // Quick Rules (§10)
  overtakeStep1Title: 'Cambia de carril',
  overtakeStep1Body:
    'Mueve el auto a izquierda y derecha para cambiar de carril: el acelerador es automático, así que la velocidad sube sola.',
  overtakeStep2Title: 'Afloja',
  overtakeStep2BodyDrag:
    'Donde hay mucho tráfico, desliza el dedo hacia abajo para aflojar: un roce te detiene, así que aflojar es más rápido.',
  overtakeStep2BodyHold:
    'Donde hay mucho tráfico, mantén presionado ▼ para aflojar: un roce te detiene, así que aflojar es más rápido.',
  overtakeStep3Title: 'Llega primero',
  overtakeStep3Body:
    'Cruza la meta antes que los tres autos que van a su propio ritmo y se abrirá el siguiente nivel.',
};
