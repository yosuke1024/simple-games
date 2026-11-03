// English source.
export const en = {
  ridgeCannonsName: 'Ridge Cannons',
  ridgeCannonsMode_easy: 'Easy',
  ridgeCannonsMode_normal: 'Normal',
  ridgeCannonsMode_hard: 'Hard',
  ridgeCannonsYou: 'You',
  ridgeCannonsCpu: 'CPU',
  ridgeCannonsThinking: 'CPU is thinking…',
  ridgeCannonsWon: 'You won',
  ridgeCannonsLost: 'The CPU won',
  ridgeCannonsWins: 'Wins',
  ridgeCannonsBest: 'Most armor left',
  ridgeCannonsMetric: 'Armor left',
  ridgeCannonsDraw: 'Draw',
  ridgeCannonsRound: 'Round {n} / 12',
  ridgeCannonsWind: 'Wind',
  ridgeCannonsField: 'Two cannons separated by a ridge',
  ridgeCannonsAim: 'Adjust your aim, then fire.',
  ridgeCannonsDamage: 'Damage',
  ridgeCannonsAngle: 'Angle',
  ridgeCannonsPower: 'Power',
  ridgeCannonsFire: 'Fire',
  ridgeCannonsStep1Title: 'Set your aim',
  ridgeCannonsStep1Body: 'Adjust angle and power to send a shell over the ridge.',
  ridgeCannonsStep2Title: 'Read the wind',
  ridgeCannonsStep2Body:
    'The arrow shows the wind. Your last trajectory stays visible to help your next shot.',
  ridgeCannonsStep3Title: 'Trade shots',
  ridgeCannonsStep3Body:
    'Take turns with the CPU. Reduce its armor to zero, or have more armor after 12 rounds.',
} as const;
export type RidgeCannonsMessages = Record<keyof typeof en, string>;
