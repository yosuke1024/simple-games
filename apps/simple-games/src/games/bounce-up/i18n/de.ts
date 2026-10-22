/**
 * German catalog for Bounce Up.
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

export const de: BounceUpMessages = {
  bounceUpName: 'Bounce Up',
  bounceUpPlay: 'Klettern',
  bounceUpBestNote: 'Bestwert {score}',
  bounceUpWidth: 'Plattformen',
  bounceUpWidth_normal: 'Normal',
  bounceUpWidth_wide: 'Breit',
  bounceUpBest: 'Bestwert',
  bounceUpTotal: 'Gesamtpunkte',
  bounceUpBoardLabel: 'Spielfeld von Bounce Up, {state}',
  bounceUpState_ready: 'wartet auf deinen ersten Zug',
  bounceUpState_running: 'klettert',
  bounceUpState_paused: 'pausiert',
  bounceUpState_over: 'Lauf beendet',
  bounceUpTouchToStart: 'Zum Start übers Feld wischen oder ← → drücken',
  bounceUpPaused: 'Pausiert',
  bounceUpPause: 'Pause',
  bounceUpStart: 'Los',
  bounceUpClimbAgain: 'Noch mal klettern',
  bounceUpPad: 'Bewegungstasten',
  bounceUpMoveLeft: 'Nach links',
  bounceUpMoveRight: 'Nach rechts',
  bounceUpResultTitle: 'Bis {score} geklettert',
  bounceUpLiveResult: 'Der Lauf ist vorbei. Punkte: {score}.',
  bounceUpStep1Title: 'Wischen zum Bewegen',
  bounceUpStep1Body:
    'Wische mit dem Finger auf dem Feld nach links oder rechts oder drücke ← →, und auf jeder Plattform, auf der du landest, springst du von selbst ab.',
  bounceUpStep2Title: 'Die Seiten sind verbunden',
  bounceUpStep2Body:
    'Wer an einer Seite hinausläuft, kommt an der anderen wieder herein, also nutze beide, um die Plattformen darüber zu erreichen.',
  bounceUpStep3Title: 'Die Höhe ist die Punktzahl',
  bounceUpStep3Body:
    'Verpasst du die Plattformen und fällst unten hinaus, endet der Lauf, und die erreichte Höhe ist deine Punktzahl.',
};
