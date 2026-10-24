/**
 * Echo Pads — the English catalog, and the source every other locale is
 * written from (docs/ECHO_PADS_RULES.md §14). Bundled into the game's chunk,
 * not the entry, and registered on chunk load by ./index.ts (issue #38).
 *
 * Words kept apart on purpose (the glossary of §14): a "pad" is one of the
 * four or six buttons; the "sequence" is the run's whole order; "length" is
 * how many pads a round plays; "Play" starts a playback and "Listen again"
 * is the same button before input or after a miss; the three paces are
 * names, not speeds. Nothing here praises, promises an effect on memory, or
 * says anything about saving, cost or being offline.
 */
export const en = {
  echoPadsName: 'Echo Pads',

  echoPadsTier_4: '4 pads',
  echoPadsTier_6: '6 pads',
  echoPadsLength: 'Length {n}',
  echoPadsLevelDetail: '{tier} · length {length}',

  echoPadsPace: 'Pace',
  echoPadsPace_calm: 'Calm',
  echoPadsPace_normal: 'Normal',
  echoPadsPace_quick: 'Quick',

  echoPadsPlay: 'Play',
  echoPadsListenAgain: 'Listen again',
  echoPadsStop: 'Stop',

  echoPadsRound: 'Length {k} of {target}',
  echoPadsStatusIdle: 'Press Play to hear {k} pads.',
  echoPadsStatusPlaying: 'Playing {k} pads…',
  echoPadsStatusYourTurn: 'Your turn: tap the {k} pads in the same order.',
  echoPadsStatusAgain: 'Tap all {k} pads again, from the first.',
  echoPadsStatusReview: 'Playing the {k} pads of this round again…',

  echoPadsMark_circle: 'Circle',
  echoPadsMark_triangle: 'Triangle',
  echoPadsMark_square: 'Square',
  echoPadsMark_star: 'Star',
  echoPadsMark_diamond: 'Diamond',
  echoPadsMark_cross: 'Cross',
  echoPadsPos_topLeft: 'top left',
  echoPadsPos_topMiddle: 'top middle',
  echoPadsPos_topRight: 'top right',
  echoPadsPos_bottomLeft: 'bottom left',
  echoPadsPos_bottomMiddle: 'bottom middle',
  echoPadsPos_bottomRight: 'bottom right',
  echoPadsPadLabel: '{mark}, {position}',
  echoPadsPadsLabel: 'Pads',
  echoPadsExpectedLabel: '{pad} (the pad that came next)',

  echoPadsMissTitle: 'The run ended at length {k}',
  echoPadsMissBody: 'Pad {index} of {k} was {pad}.',
  echoPadsResultTitle: 'All {n} returned',
  echoPadsLongest: 'Longest returned',
  echoPadsLongestNone: 'None',
  echoPadsReplays: 'Listened again',
  echoPadsPacesHeard: 'Pace',
  echoPadsNewSequence: 'New sequence',

  echoPadsLevelCell: '{level}, {detail}',
  echoPadsLevelCellCleared: '{level}, {detail}, cleared',
  echoPadsReplaceTitle: 'Replace the run in progress?',
  echoPadsReplaceBody: 'The run at {current} will be replaced by a new run at {next}.',

  echoPadsStatStarted: 'Runs started',
  echoPadsStatCleared: 'Cleared',
  echoPadsStatMissed: 'Ended by a miss',
  echoPadsStatLevels: 'Levels cleared',
  echoPadsStatDays: 'Days completed',

  echoPadsStep1Title: 'Listen',
  echoPadsStep1Body:
    'Press ▶ and the pads light up and sound one by one — remember the order (until your first tap, you can listen again as often as you like).',
  echoPadsStep2Title: 'Repeat',
  echoPadsStep2Body: 'Then tap the pads in the same order.',
  echoPadsStep3Title: 'Grow',
  echoPadsStep3Body: 'Each time you return it, the order grows by one — there is no time limit.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type EchoPadsMessages = Record<keyof typeof en, string>;
