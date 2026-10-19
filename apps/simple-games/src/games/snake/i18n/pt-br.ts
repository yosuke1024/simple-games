/**
 * Brazilian Portuguese catalog for Snake.
 *
 * Provenance (docs/SNAKE_RULES.md §14, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI (Claude) from the English source on 2026-10-17. **No native
 * speaker has read it**, and it is not to be treated as reviewed. The title
 * (`snakeName`) is a proper noun and stays as it is in every locale.
 *
 * The `você` of the shell, `Pontos` for the score (shell `score`), `casa` for
 * a square and `tabuleiro` for the board. The speed names agree with
 * `velocidade`; inside a sentence a speed goes in brackets.
 */
import type { SnakeMessages } from './en';

export const ptBR: SnakeMessages = {
  snakeName: 'Snake',

  // Home
  snakeSpeed: 'Velocidade',
  snakeSpeed_slow: 'Lenta',
  snakeSpeed_normal: 'Normal',
  snakeSpeed_fast: 'Rápida',
  snakeResumeNote: 'Pontos {score} · {speed}',
  snakeBestNote: 'Recorde {score}',

  // Game screen
  snakeTopBest: 'Recorde {score} · {speed}',
  snakeBoardLabel: 'Tabuleiro de Snake, {size} por {size}: {state}',
  snakeStateReady: 'pronto para começar',
  snakeStateRunning: 'em movimento',
  snakeStatePaused: 'pausado',
  snakeStateOver: 'fim de jogo',
  snakeStateCleared: 'tabuleiro cheio',
  snakeControls: 'Controles',
  snakeDir_up: 'Cima',
  snakeDir_down: 'Baixo',
  snakeDir_left: 'Esquerda',
  snakeDir_right: 'Direita',
  snakeStart: 'Começar',
  snakePause: 'Pausar',
  snakePaused: 'Pausado',
  snakeNextTurn: 'Próxima direção: {direction}',

  // Screen reader announcements (polite; never one per tick)
  snakeLiveStarted: 'Partida iniciada',
  snakeLivePaused: 'Pausado. Pontos: {score}',
  snakeLiveResumed: 'Partida retomada',
  snakeLiveScore: 'Pontos: {score}',
  snakeLiveWall: 'Fim de jogo: a cobra bateu na parede. Pontos: {score}',
  snakeLiveSelf: 'Fim de jogo: a cobra bateu no próprio corpo. Pontos: {score}',
  snakeLiveCleared: 'Tabuleiro cheio. Pontos: {score}',
  snakeLiveNextCleared: 'Próxima direção cancelada',

  // Result
  snakeOverTitle: 'Fim de jogo',
  snakeClearedTitle: 'Tabuleiro cheio',
  snakeOverWall: 'A cobra bateu na parede.',
  snakeOverSelf: 'A cobra bateu no próprio corpo.',
  snakeClearedBody: 'A cobra ocupa todas as casas.',
  snakeLength: 'Comprimento',
  snakeNewBest: 'Novo recorde ({speed})',
  snakeBestAt: 'Recorde ({speed}): {score}',

  // Statistics
  snakeBestScore: 'Melhor pontuação',
  snakeClears: 'Tabuleiros cheios',

  // Quick Rules
  snakeStep1Title: 'Vire',
  snakeStep1Body:
    'Deslize, toque numa seta ou aperte uma tecla de seta para virar: a cobra continua andando, uma casa por vez.',
  snakeStep2Title: 'Coma',
  snakeStep2Body: 'Cada comida deixa a cobra uma casa mais comprida e vale um ponto.',
  snakeStep3Title: 'Não bata',
  snakeStep3Body:
    'Bater numa parede ou no próprio corpo encerra a partida; encha o tabuleiro inteiro para vencer.',
  snakeFigureTurn: 'Uma cobra prestes a virar para cima, rumo à comida',
  snakeFigureEat: 'Uma cobra a uma casa da comida',
  snakeFigureCrash: 'Uma cobra que bateu na parede',
};
