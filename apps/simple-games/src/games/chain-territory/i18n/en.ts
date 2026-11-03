// English source.
export const en = {
  chainTerritoryName: 'Chain Territory',
  chainTerritoryMode_easy: 'Easy',
  chainTerritoryMode_normal: 'Normal',
  chainTerritoryMode_hard: 'Hard',
  chainTerritoryBest: 'Fewest winning moves',
  chainTerritoryWins: 'Wins',
  chainTerritoryWon: 'You win!',
  chainTerritoryLost: 'CPU wins',
  chainTerritoryYou: 'You',
  chainTerritoryCpu: 'CPU',
  chainTerritoryEmpty: 'Empty',
  chainTerritoryField: 'Chain reaction board',
  chainTerritoryCell: 'Row {row}, column {col}: {owner}, {n} of {max}',
  chainTerritoryTurn: 'Add an orb to an empty square or one of yours.',
  chainTerritoryThinking: 'CPU is thinking…',
  chainTerritoryChain: 'The chain is spreading…',
  chainTerritoryCapacity: 'Burst at 2 in corners · 3 on edges · 4 inside',
  chainTerritoryStep1Title: 'Place an orb',
  chainTerritoryStep1Body:
    'Take turns with the CPU. Add one orb to an empty square or one you own.',
  chainTerritoryStep2Title: 'Start a chain',
  chainTerritoryStep2Body:
    'At 2 in a corner, 3 on an edge or 4 inside, orbs spread to neighbors and capture them.',
  chainTerritoryStep3Title: 'Capture every rival orb',
  chainTerritoryStep3Body:
    'After both players have moved, capture all CPU orbs to win. Undo takes back your move and the reply.',
} as const;
export type ChainTerritoryMessages = Record<keyof typeof en, string>;
