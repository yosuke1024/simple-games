/**
 * Bounce Up's own strings — the English source (docs/BOUNCE_UP_RULES.md §8):
 * bundled into the game's chunk, not the entry, and registered on chunk load
 * by ./index.ts. Written from the Japanese Quick Rules draft of §6.
 *
 * Words (§8「用語」): the things you land on are "platforms" (never "clouds" —
 * the word the shell uses for the sync it does not have), the number is a
 * "score" with no unit, and the record is "best" — never a rank. The result
 * heading states the fact, never praise.
 */
export const en = {
  bounceUpName: 'Bounce Up',
  bounceUpPlay: 'Start Climbing',
  bounceUpBestNote: 'Best {score}',
  bounceUpWidth: 'Platforms',
  bounceUpWidth_normal: 'Normal',
  bounceUpWidth_wide: 'Wide',
  bounceUpBest: 'Best score',
  bounceUpTotal: 'Total score',
  bounceUpBoardLabel: 'Bounce Up board, {state}',
  bounceUpState_ready: 'waiting for your first move',
  bounceUpState_running: 'climbing',
  bounceUpState_paused: 'paused',
  bounceUpState_over: 'run over',
  bounceUpTouchToStart: 'Slide on the board or press ← → to start',
  bounceUpPaused: 'Paused',
  bounceUpPause: 'Pause',
  bounceUpStart: 'Start',
  bounceUpClimbAgain: 'Climb again',
  bounceUpPad: 'Move buttons',
  bounceUpMoveLeft: 'Move left',
  bounceUpMoveRight: 'Move right',
  bounceUpResultTitle: 'Reached {score}',
  bounceUpLiveResult: 'The run is over. Score {score}.',
  bounceUpStep1Title: 'Slide to move',
  bounceUpStep1Body:
    'Slide a finger left or right on the board, or press ← →, and you bounce by yourself on every platform you land on.',
  bounceUpStep2Title: 'The sides join',
  bounceUpStep2Body:
    'Go off one side and you come back in on the other, so use both to reach the platforms above.',
  bounceUpStep3Title: 'Height is your score',
  bounceUpStep3Body:
    'Miss the platforms and fall off the bottom, and the run ends with the height you reached as your score.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type BounceUpMessages = Record<keyof typeof en, string>;
