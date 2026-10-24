/**
 * French catalog for Bounce Up.
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

export const fr: BounceUpMessages = {
  bounceUpName: 'Bounce Up',
  bounceUpPlay: 'Commencer à grimper',
  bounceUpBestNote: 'Meilleur {score}',
  bounceUpWidth: 'Plateformes',
  bounceUpWidth_normal: 'Normales',
  bounceUpWidth_wide: 'Larges',
  bounceUpBest: 'Meilleur score',
  bounceUpTotal: 'Score total',
  bounceUpBoardLabel: 'Plateau de Bounce Up, {state}',
  bounceUpState_ready: 'en attente de votre premier geste',
  bounceUpState_running: 'en pleine montée',
  bounceUpState_paused: 'en pause',
  bounceUpState_over: 'partie terminée',
  bounceUpTouchToStart: 'Glissez ou appuyez sur ← → pour commencer',
  bounceUpPaused: 'En pause',
  bounceUpPause: 'Mettre en pause',
  bounceUpStart: 'Commencer',
  bounceUpClimbAgain: 'Grimper à nouveau',
  bounceUpPad: 'Boutons de déplacement',
  bounceUpMoveLeft: 'Aller à gauche',
  bounceUpMoveRight: 'Aller à droite',
  bounceUpResultTitle: 'Hauteur atteinte : {score}',
  bounceUpLiveResult: 'La partie est terminée. Score : {score}.',
  bounceUpStep1Title: 'Glissez pour bouger',
  bounceUpStep1Body:
    'Glissez un doigt vers la gauche ou la droite sur le plateau, ou appuyez sur ← →, et vous rebondissez tout seul sur chaque plateforme où vous atterrissez.',
  bounceUpStep2Title: 'Les bords se rejoignent',
  bounceUpStep2Body:
    'En sortant par un bord, vous revenez par l’autre : servez-vous des deux pour atteindre les plateformes du dessus.',
  bounceUpStep3Title: 'La hauteur fait le score',
  bounceUpStep3Body:
    'Si vous manquez les plateformes et tombez par le bas, la partie s’arrête et la hauteur atteinte devient votre score.',
};
