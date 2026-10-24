/**
 * German catalog for Snake.
 *
 * Provenance (docs/SNAKE_RULES.md §14, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI (Claude) from the English source on 2026-10-17. **No native
 * speaker has read it**, and it is not to be treated as reviewed. The title
 * (`snakeName`) is a proper noun and stays as it is in every locale.
 *
 * Terms follow the shell and the other games: `Punkte` for the score (shell
 * `score`), `Rekord` for a best (Number Match), `Feld` for a square and
 * `Spielfeld` for the board, the informal `du` of the shell. `Tempo` names
 * the speed: shorter than `Geschwindigkeit`, and usual in games. A speed
 * inside a sentence goes in brackets, so the label never has to decline.
 * `Starten`, not the shell's `Start`, which is the way home (`backHome`) in
 * German. A no-break space keeps each dash off the start of a line.
 */
import type { SnakeMessages } from './en';

export const de: SnakeMessages = {
  snakeName: 'Snake',

  // Home
  snakeSpeed: 'Tempo',
  snakeSpeed_slow: 'Langsam',
  snakeSpeed_normal: 'Normal',
  snakeSpeed_fast: 'Schnell',
  snakeResumeNote: 'Punkte {score} · {speed}',
  snakeBestNote: 'Rekord {score}',

  // Game screen
  snakeTopBest: 'Rekord {score} · {speed}',
  snakeBoardLabel: 'Snake-Spielfeld, {size} mal {size}: {state}',
  snakeStateReady: 'bereit zum Start',
  snakeStateRunning: 'in Bewegung',
  snakeStatePaused: 'pausiert',
  snakeStateOver: 'Spiel vorbei',
  snakeStateCleared: 'Spielfeld voll',
  snakeControls: 'Steuerung',
  snakeDir_up: 'Oben',
  snakeDir_down: 'Unten',
  snakeDir_left: 'Links',
  snakeDir_right: 'Rechts',
  snakeStart: 'Starten',
  snakePause: 'Pause',
  snakePaused: 'Pausiert',
  snakeNextTurn: 'Nächste Richtung: {direction}',

  // Screen reader announcements (polite; never one per tick)
  snakeLiveStarted: 'Gestartet',
  snakeLivePaused: 'Pausiert. Punkte: {score}',
  snakeLiveResumed: 'Fortgesetzt',
  snakeLiveScore: 'Punkte: {score}',
  snakeLiveWall: 'Spiel vorbei: Die Schlange ist gegen die Wand gestoßen. Punkte: {score}',
  snakeLiveSelf:
    'Spiel vorbei: Die Schlange ist gegen ihren eigenen Körper gestoßen. Punkte: {score}',
  snakeLiveCleared: 'Spielfeld voll. Punkte: {score}',
  snakeLiveNextCleared: 'Nächste Richtung aufgehoben',

  // Result
  snakeOverTitle: 'Spiel vorbei',
  snakeClearedTitle: 'Spielfeld voll',
  snakeOverWall: 'Die Schlange ist gegen die Wand gestoßen.',
  snakeOverSelf: 'Die Schlange ist gegen ihren eigenen Körper gestoßen.',
  snakeClearedBody: 'Die Schlange bedeckt jedes Feld.',
  snakeLength: 'Länge',
  snakeNewBest: 'Neuer Rekord ({speed})',
  snakeBestAt: 'Rekord ({speed}): {score}',

  // Statistics
  snakeBestScore: 'Beste Punktzahl',
  snakeClears: 'Volle Spielfelder',

  // Quick Rules
  snakeStep1Title: 'Abbiegen',
  snakeStep1Body:
    'Wische, tippe einen Pfeil an oder drücke eine Pfeiltaste\u00a0– die Schlange kriecht stets Feld für Feld weiter.',
  snakeStep2Title: 'Fressen',
  snakeStep2Body: 'Jedes Futter macht die Schlange ein Feld länger und bringt einen Punkt.',
  snakeStep3Title: 'Nicht anstoßen',
  snakeStep3Body:
    'Eine Wand oder der eigene Körper beendet die Runde\u00a0– füll das ganze Spielfeld, um zu gewinnen.',
  snakeFigureTurn: 'Eine Schlange kurz vor dem Abbiegen nach oben zum Futter',
  snakeFigureEat: 'Eine Schlange ein Feld vor dem Futter',
  snakeFigureCrash: 'Eine Schlange, die gegen die Wand gestoßen ist',
};
