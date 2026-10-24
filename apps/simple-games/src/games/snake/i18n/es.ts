/**
 * Spanish catalog for Snake.
 *
 * Provenance (docs/SNAKE_RULES.md §14, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI (Claude) from the English source on 2026-10-17. **No native
 * speaker has read it**, and it is not to be treated as reviewed. The title
 * (`snakeName`) is a proper noun and stays as it is in every locale.
 *
 * Neutral Latin-American leaning Spanish with the informal `tú` of the
 * shell: `Puntos` for the score (shell `score`), `casilla` for a square,
 * `tablero` for the board. The speed names agree with `velocidad`; inside a
 * sentence a speed goes in brackets, so it never has to agree with anything else.
 */
import type { SnakeMessages } from './en';

export const es: SnakeMessages = {
  snakeName: 'Snake',

  // Home
  snakeSpeed: 'Velocidad',
  snakeSpeed_slow: 'Lenta',
  snakeSpeed_normal: 'Normal',
  snakeSpeed_fast: 'Rápida',
  snakeResumeNote: 'Puntos {score} · {speed}',
  snakeBestNote: 'Récord {score}',

  // Game screen
  snakeTopBest: 'Récord {score} · {speed}',
  snakeBoardLabel: 'Tablero de Snake, {size} por {size}: {state}',
  snakeStateReady: 'listo para empezar',
  snakeStateRunning: 'en movimiento',
  snakeStatePaused: 'en pausa',
  snakeStateOver: 'fin de la partida',
  snakeStateCleared: 'tablero lleno',
  snakeControls: 'Controles',
  snakeDir_up: 'Arriba',
  snakeDir_down: 'Abajo',
  snakeDir_left: 'Izquierda',
  snakeDir_right: 'Derecha',
  snakeStart: 'Empezar',
  snakePause: 'Pausa',
  snakePaused: 'En pausa',
  snakeNextTurn: 'Próxima dirección: {direction}',

  // Screen reader announcements (polite; never one per tick)
  snakeLiveStarted: 'Partida iniciada',
  snakeLivePaused: 'En pausa. Puntos: {score}',
  snakeLiveResumed: 'Partida reanudada',
  snakeLiveScore: 'Puntos: {score}',
  snakeLiveWall: 'Fin de la partida: la serpiente chocó con la pared. Puntos: {score}',
  snakeLiveSelf: 'Fin de la partida: la serpiente chocó consigo misma. Puntos: {score}',
  snakeLiveCleared: 'Tablero lleno. Puntos: {score}',
  snakeLiveNextCleared: 'Próxima dirección cancelada',

  // Result
  snakeOverTitle: 'Fin de la partida',
  snakeClearedTitle: 'Tablero lleno',
  snakeOverWall: 'La serpiente chocó con la pared.',
  snakeOverSelf: 'La serpiente chocó consigo misma.',
  snakeClearedBody: 'La serpiente cubre todas las casillas.',
  snakeLength: 'Longitud',
  snakeNewBest: 'Nuevo récord ({speed})',
  snakeBestAt: 'Récord ({speed}): {score}',

  // Statistics
  snakeBestScore: 'Mejor puntuación',
  snakeClears: 'Tableros llenos',

  // Quick Rules
  snakeStep1Title: 'Gira',
  snakeStep1Body:
    'Desliza, toca una flecha o pulsa una tecla de flecha para girar: la serpiente sigue avanzando casilla a casilla.',
  snakeStep2Title: 'Come',
  snakeStep2Body: 'Cada comida alarga la serpiente una casilla y suma un punto.',
  snakeStep3Title: 'No choques',
  snakeStep3Body:
    'Chocar con una pared o con la propia serpiente termina la partida; llena todo el tablero para ganar.',
  snakeFigureTurn: 'Una serpiente a punto de girar hacia arriba para ir a la comida',
  snakeFigureEat: 'Una serpiente a una casilla de la comida',
  snakeFigureCrash: 'Una serpiente que ha chocado con la pared',
};
