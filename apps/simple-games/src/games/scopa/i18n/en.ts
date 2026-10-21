/**
 * This game's own strings (issue #38 pattern): bundled into the game's chunk,
 * not the entry, and registered on chunk load by ./index.ts.
 *
 * `en` is the original (docs/SCOPA_RULES.md §12). The terms follow the
 * glossary there: "scopa" and "primiera" are kept as loanwords, the coin suit
 * is called by what is drawn — Diamonds — and the 7♦ by its symbol. Nothing
 * here praises a win or scolds a loss, and nothing calls the CPU strong or AI.
 * The results state facts: who took the match, and the score.
 */
export const en = {
  scopaName: 'Scopa',

  // Quick Rules (§10): three steps, one sentence each.
  scopaStep1Title: 'Take',
  scopaStep1Body:
    'Play one card: take a table card of the same value, or, if there is none, cards that add up to it.',
  scopaStep2Title: 'Place, or sweep',
  scopaStep2Body:
    'A card that takes nothing is placed on the table, and taking every card on the table scores a point: a scopa.',
  scopaStep3Title: 'Eleven to win',
  scopaStep3Body:
    'Each deal scores a point each for most cards, most Diamonds, the 7♦ and the primiera, and 11 or more while ahead wins.',

  // The two sides and the cards.
  scopaYou: 'You',
  scopaCpu: 'CPU',
  scopaSuit_spades: 'spades',
  scopaSuit_hearts: 'hearts',
  scopaSuit_diamonds: 'diamonds',
  scopaSuit_clubs: 'clubs',
  scopaCardLabel: '{face} of {suit}',

  // The table (§7, §11.2).
  scopaTableLabel: 'Table',
  scopaHandLabel: 'Your hand',
  scopaHandCanTake: '{card}, can take',
  scopaHandCannotTake: '{card}, cannot take now',
  scopaTableCanTake: '{card}, can be taken',
  scopaTableInGroup: '{card}, in your group',
  scopaPlaceHere: 'Place here',
  scopaStockLabel: 'Stock: {n} left',
  // Counts are written as "name: number" wherever the number can be 1, so no
  // sentence needs a plural form. The band's 7♦ and dealer parts fill
  // {settebello} and {dealer} — empty when they do not apply — and carry their
  // own leading punctuation.
  scopaCpuHandLabel: 'Cards in the CPU’s hand: {n}',
  scopaBandLabel:
    '{who}: score {score}; this deal: cards {cards}, Diamonds {diamonds}, scopas {scopas}{settebello}{dealer}',
  scopaBandSettebello: ', has the 7♦',
  scopaBandDealer: ', dealer',
  scopaPrimieraLabel: 'Your primiera: {total}',
  scopaPrimieraSuit: '{suit}: {card}, {value}',
  scopaPrimieraMissing: '{suit}: none yet',

  // The line under the table: one line, always present.
  scopaLineYourTurn: 'Your turn: play a card',
  scopaLineCpuTurn: 'CPU’s turn',
  scopaLineDealing: 'Dealing three cards each',
  scopaLinePlace: 'It takes nothing: place it, or pick another card',
  scopaLineTakeOne: 'Tap again to take',
  scopaLineChooseSame: 'Choose which card to take',
  scopaLineBuildSum: 'Pick cards that add up to {n} ({sum} so far)',
  scopaLineCpuTook: 'CPU took',
  scopaLineCpuPlaced: 'CPU placed',
  scopaLineScopaYou: 'Scopa: you emptied the table',
  scopaLineScopaCpu: 'Scopa: the CPU emptied the table',
  scopaLineSweepYou: 'Last cards on the table: to you',
  scopaLineSweepCpu: 'Last cards on the table: to the CPU',
  scopaSayCpuTook: 'CPU played {card} and took {cards}',
  scopaSayCpuPlaced: 'CPU placed {card}',
  scopaSaySweepYou: 'You take the cards left on the table: {cards}',
  scopaSaySweepCpu: 'The CPU takes the cards left on the table: {cards}',
  // Two sentences read out one after the other; the locale owns the joint.
  scopaSayThen: '{first}. {then}',

  // A settled deal (§3.2, §11.2).
  scopaDealTitle: 'Deal {n}',
  scopaColCategory: 'Category',
  scopaColPoint: 'Point',
  scopaCatCards: 'Cards',
  scopaCatDiamonds: 'Diamonds',
  scopaCatPrimiera: 'Primiera',
  scopaCatScopa: 'Scopa',
  scopaPrimieraShort: '{total} ({suits} of 4 suits)',
  scopaDealPoints: 'This deal',
  scopaSweepYou: 'Cards left on the table, taken by you: {n}',
  scopaSweepCpu: 'Cards left on the table, taken by the CPU: {n}',
  scopaNextDeal: 'Next deal',

  // The match's end (§3.4) — the fact, and nothing about it.
  scopaWinTitle: 'You won the match',
  scopaLoseTitle: 'The CPU won the match',
  scopaDecidingDeal: 'The last deal',

  // Home and statistics (§8, §9.3).
  scopaRecordNote: 'Won {wins} · Lost {losses}',
  scopaWins: 'Wins',
  scopaLosses: 'Losses',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type ScopaMessages = Record<keyof typeof en, string>;
