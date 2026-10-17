/**
 * French catalog for Snake.
 *
 * Provenance (docs/SNAKE_RULES.md §14, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI (Claude) from the English source on 2026-10-17. **No native
 * speaker has read it**, and it is not to be treated as reviewed. The title
 * (`snakeName`) is a proper noun and stays as it is in every locale.
 *
 * The `vous` of the shell, `Score` for the score (shell `score`), `Record` for
 * a best (Number Match), `case` for a square and `plateau` for the board.
 * The speed names agree with `vitesse`; inside a sentence a speed goes in
 * brackets. Plain spaces before `:` and `;`, as in the other French catalogs.
 */
import type { SnakeMessages } from './en';

export const fr: SnakeMessages = {
  snakeName: 'Snake',

  // Home
  snakeSpeed: 'Vitesse',
  snakeSpeed_slow: 'Lente',
  snakeSpeed_normal: 'Normale',
  snakeSpeed_fast: 'Rapide',
  snakeResumeNote: 'Score {score} · {speed}',
  snakeBestNote: 'Record {score}',

  // Game screen
  snakeTopBest: 'Record {score} · {speed}',
  snakeBoardLabel: 'Plateau de Snake, {size} par {size} : {state}',
  snakeStateReady: 'prêt à démarrer',
  snakeStateRunning: 'en mouvement',
  snakeStatePaused: 'en pause',
  snakeStateOver: 'partie terminée',
  snakeStateCleared: 'plateau rempli',
  snakeControls: 'Commandes',
  snakeDir_up: 'Haut',
  snakeDir_down: 'Bas',
  snakeDir_left: 'Gauche',
  snakeDir_right: 'Droite',
  snakeStart: 'Démarrer',
  snakePause: 'Pause',
  snakePaused: 'En pause',
  snakeNextTurn: 'Prochaine direction : {direction}',

  // Screen reader announcements (polite; never one per tick)
  snakeLiveStarted: 'C’est parti',
  snakeLivePaused: 'En pause. Score : {score}',
  snakeLiveResumed: 'Reprise',
  snakeLiveScore: 'Score : {score}',
  snakeLiveWall: 'Partie terminée : le serpent a heurté le mur. Score : {score}',
  snakeLiveSelf: 'Partie terminée : le serpent s’est heurté à son propre corps. Score : {score}',
  snakeLiveCleared: 'Plateau rempli. Score : {score}',
  snakeLiveNextCleared: 'Prochaine direction annulée',

  // Result
  snakeOverTitle: 'Partie terminée',
  snakeClearedTitle: 'Plateau rempli',
  snakeOverWall: 'Le serpent a heurté le mur.',
  snakeOverSelf: 'Le serpent s’est heurté à son propre corps.',
  snakeClearedBody: 'Le serpent couvre toutes les cases.',
  snakeLength: 'Longueur',
  snakeNewBest: 'Nouveau record ({speed})',
  snakeBestAt: 'Record ({speed}) : {score}',

  // Statistics
  snakeBestScore: 'Meilleur score',
  snakeClears: 'Plateaux remplis',

  // Quick Rules
  snakeStep1Title: 'Tourner',
  snakeStep1Body:
    'Balayez, touchez une flèche ou utilisez les touches fléchées : le serpent avance sans arrêt, case par case.',
  snakeStep2Title: 'Manger',
  snakeStep2Body: 'En mangeant, le serpent s’allonge d’une case et marque un point.',
  snakeStep3Title: 'Évitez les chocs',
  snakeStep3Body:
    'Toucher un mur ou son propre corps met fin à la partie ; remplissez tout le plateau pour gagner.',
  snakeFigureTurn: 'Un serpent qui va tourner vers le haut pour rejoindre la nourriture',
  snakeFigureEat: 'Un serpent à une case de la nourriture',
  snakeFigureCrash: 'Un serpent qui a heurté le mur',
};
