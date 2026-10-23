/** AI-authored source; no human review claimed. See docs/NIM_RULES.md. */
export const en = {
  nimName: 'Nim',
  nimMode_easy: 'Easy',
  nimMode_normal: 'Normal',
  nimMode_hard: 'Hard',
  nimRow: 'Row {row}: {count} stones',
  nimTake: 'Take {count}',
  nimYourTurn: 'Your turn',
  nimCpuTurn: 'CPU’s turn',
  nimPaused: 'Paused. Resume when ready.',
  nimLastMove: 'Last move: {count} from row {row}.',
  nimGoal: 'Take the last stone to win.',
  nimChooseRow: 'Choose one row.',
  nimChooseCount: 'Choose how many to take.',
  nimWon: 'You win!',
  nimLost: 'CPU wins',
  nimOpponent: 'Opponent',
  nimWins: 'Wins',
  nimLosses: 'Losses',
  nimStep1Title: 'Choose one row',
  nimStep1Body: 'On your turn, choose a row with stones; you always move first.',
  nimStep2Title: 'Take one or more',
  nimStep2Body: 'Choose how many stones to remove from that row, then confirm.',
  nimStep3Title: 'Take the last stone',
  nimStep3Body:
    'You and the CPU take turns; whoever takes the last stone wins. Undo takes back your whole turn.',
} as const;
export type NimMessages = Record<keyof typeof en, string>;
