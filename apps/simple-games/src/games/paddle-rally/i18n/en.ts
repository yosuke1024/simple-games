/** AI-authored; no human review claimed. */
export const en = {
  paddleRallyMode_easy: 'Easy',
  paddleRallyMode_normal: 'Normal',
  paddleRallyMode_hard: 'Hard',
  paddleRallyWon: 'You win!',
  paddleRallyLost: 'CPU wins',
  paddleRallyWins: 'Wins',
  paddleRallyLosses: 'Losses',
  paddleRallyName: 'Paddle Rally',
  paddleRallyYou: 'You',
  paddleRallyScore: 'Score',
  paddleRallyGoal: 'First to 5',
  paddleRallyBoard: 'Paddle court: you below, CPU above',
  paddleRallyControls: 'Drag, or use ← → / A D.',
  paddleRallyLeft: 'Move left',
  paddleRallyRight: 'Move right',
  paddleRallyServe: 'Serve',
  paddleRallyPause: 'Pause',
  paddleRallyPaused: 'Paused. Resume when ready.',
  paddleRallyReady: 'Serve when ready.',
  paddleRallyStep1Title: 'Move your paddle',
  paddleRallyStep1Body:
    'Drag left and right, or use the arrow buttons or keys, to move the lower paddle.',
  paddleRallyStep2Title: 'Find the angle',
  paddleRallyStep2Body: 'Hit with the edge of your paddle to send the ball sideways past the CPU.',
  paddleRallyStep3Title: 'First to five',
  paddleRallyStep3Body:
    'Score when the CPU misses; first to five wins, and each point waits for your serve.',
} as const;
export type PaddleRallyMessages = Record<keyof typeof en, string>;
