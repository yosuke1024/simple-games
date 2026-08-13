/**
 * Bubble Pop's own strings (issue #38): bundled into the game's chunk, not
 * the entry, and registered on chunk load by ./index.ts.
 */
export const en = {
  bubbleName: 'Bubble Pop',
  bubbleBoardLabel: 'Bubble Pop board',
  bubbleShotsLabel: '{n} shots until the ceiling drops',
  bubbleCurrentLabel: 'Current bubble: {color}',
  bubbleNextLabel: 'Next bubble: {color}',
  bubbleSwapLabel: 'Swap current and next bubble',
  bubbleAimLabel: 'Aiming — landing row {row}, column {col}',
  bubbleClearedTitle: 'Board cleared!',
  bubbleClearedBody: 'Every bubble is down.',
  bubbleFailedTitle: 'Not this time',
  bubbleFailedBody: 'Retry is free — same board, same bubbles.',
  bubbleStep1Title: 'Drag to aim',
  bubbleStep1Body:
    'The guide line always shows exactly where the bubble will land — free, always on.',
  bubbleStep2Title: '3 in a row pops',
  bubbleStep2Body:
    'Match 3 or more of the same color and they pop. Bubbles left floating fall too.',
  bubbleStep3Title: 'The ceiling creeps down',
  bubbleStep3Body:
    'Every few shots the ceiling drops a row. Clear bubbles before one reaches the dotted line.',
  bubbleColor_blue: 'blue',
  bubbleColor_green: 'green',
  bubbleColor_yellow: 'yellow',
  bubbleColor_purple: 'purple',
  bubbleColor_orange: 'orange',
  bubbleColor_cyan: 'cyan',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type BubblePopMessages = Record<keyof typeof en, string>;
