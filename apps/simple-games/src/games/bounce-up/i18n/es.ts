/**
 * Spanish catalog for Bounce Up.
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

export const es: BounceUpMessages = {
  bounceUpName: 'Bounce Up',
  bounceUpPlay: 'Empezar a subir',
  bounceUpBestNote: 'Mejor {score}',
  bounceUpWidth: 'Plataformas',
  bounceUpWidth_normal: 'Normales',
  bounceUpWidth_wide: 'Anchas',
  bounceUpBest: 'Mejor puntuación',
  bounceUpTotal: 'Puntuación total',
  bounceUpBoardLabel: 'Tablero de Bounce Up, {state}',
  bounceUpState_ready: 'esperando tu primer movimiento',
  bounceUpState_running: 'subiendo',
  bounceUpState_paused: 'en pausa',
  bounceUpState_over: 'partida terminada',
  bounceUpTouchToStart: 'Desliza en el tablero o pulsa ← → para empezar',
  bounceUpPaused: 'En pausa',
  bounceUpPause: 'Pausa',
  bounceUpStart: 'Empezar',
  bounceUpClimbAgain: 'Subir otra vez',
  bounceUpPad: 'Botones de movimiento',
  bounceUpMoveLeft: 'Mover a la izquierda',
  bounceUpMoveRight: 'Mover a la derecha',
  bounceUpResultTitle: 'Llegaste a {score}',
  bounceUpLiveResult: 'La partida terminó. Puntuación {score}.',
  bounceUpStep1Title: 'Desliza para moverte',
  bounceUpStep1Body:
    'Desliza un dedo a izquierda o derecha en el tablero, o pulsa ← →, y rebotarás solo en cada plataforma donde caigas.',
  bounceUpStep2Title: 'Los lados se unen',
  bounceUpStep2Body:
    'Si sales por un lado, vuelves a entrar por el otro, así que usa los dos para llegar a las plataformas de arriba.',
  bounceUpStep3Title: 'La altura es la puntuación',
  bounceUpStep3Body:
    'Si fallas las plataformas y caes por abajo, la partida termina y la altura alcanzada es tu puntuación.',
};
