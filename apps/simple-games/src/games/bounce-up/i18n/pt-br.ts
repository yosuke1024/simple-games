/**
 * Brazilian Portuguese catalog for Bounce Up.
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

export const ptBR: BounceUpMessages = {
  bounceUpName: 'Bounce Up',
  bounceUpPlay: 'Começar a subir',
  bounceUpBestNote: 'Melhor {score}',
  bounceUpWidth: 'Plataformas',
  bounceUpWidth_normal: 'Normais',
  bounceUpWidth_wide: 'Largas',
  bounceUpBest: 'Melhor pontuação',
  bounceUpTotal: 'Pontuação total',
  bounceUpBoardLabel: 'Tabuleiro do Bounce Up, {state}',
  bounceUpState_ready: 'esperando seu primeiro movimento',
  bounceUpState_running: 'subindo',
  bounceUpState_paused: 'pausado',
  bounceUpState_over: 'partida encerrada',
  bounceUpTouchToStart: 'Deslize no tabuleiro ou aperte ← → para começar',
  bounceUpPaused: 'Pausado',
  bounceUpPause: 'Pausar',
  bounceUpStart: 'Começar',
  bounceUpClimbAgain: 'Subir de novo',
  bounceUpPad: 'Botões de movimento',
  bounceUpMoveLeft: 'Mover para a esquerda',
  bounceUpMoveRight: 'Mover para a direita',
  bounceUpResultTitle: 'Chegou a {score}',
  bounceUpLiveResult: 'A partida acabou. Pontuação {score}.',
  bounceUpStep1Title: 'Deslize para se mover',
  bounceUpStep1Body:
    'Deslize o dedo para a esquerda ou a direita no tabuleiro, ou aperte ← →, e você quica sozinho em cada plataforma onde cair.',
  bounceUpStep2Title: 'Os lados se ligam',
  bounceUpStep2Body:
    'Saindo por um lado, você volta pelo outro, então use os dois para alcançar as plataformas de cima.',
  bounceUpStep3Title: 'A altura é a pontuação',
  bounceUpStep3Body:
    'Se errar as plataformas e cair pela parte de baixo, a partida termina e a altura alcançada vira sua pontuação.',
};
