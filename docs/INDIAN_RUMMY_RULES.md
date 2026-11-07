# Indian Rummy

Adopted 2026-11-05; implemented for CPU and native Nearby play. Four-seat 13-card rummy,
two standard decks plus two printed jokers (106 individually identified cards).
One deal is one game. No stakes, drop penalties, betting or reaction timer.

- Deal thirteen each. Expose a separate wild-indicator card: every card of its
  rank is wild; printed joker indicator makes aces wild. Indicator is not drawn.
  Start a face-up discard, with the remaining cards as closed stock.
- On each turn draw one from stock or top discard, then discard one. A wild
  or printed joker cannot be picked from the discard. A card just picked from
  discard cannot be immediately thrown back. Recycle discards except the top
  when stock runs out. Keep stock/indicator distinct from the hand partition.
- Declare by choosing the final discard when the remaining thirteen cards
  form valid melds: at least two sequences, at least one pure sequence, and
  every card used once. Sequences have 3+ consecutive ranks in one suit;
  A-2-3 and Q-K-A are allowed, wrapping K-A-2 is not. Wild cards may substitute
  missing ranks in an impure sequence. A wild-rank card used in its natural
  position may form a pure sequence. Duplicate physical copies cannot stand
  for the same natural position in one sequence.
- Sets contain three or four of one rank in distinct suits, with wilds allowed
  as substitutes. A meld entirely composed of substitutes is not accepted;
  a sequence or set must contain a natural card. Duplicate suits do not make a valid set. There is no table
  melding or laying off onto opponents. The app suggests a valid grouping;
  it does not auto-declare on behalf of a human, and the player's own
  arrangement of the hand is never asked to match it (see Hand arrangement).
- Invalid declarations are disabled/rejected with an explanation, without an
  artificial penalty. Winner has zero penalty. For others, unmatched cards
  score A/court=10, number=face value, wild/printed joker=0, capped at 80.
  Without a pure sequence all cards count; with a pure sequence but fewer than
  two sequences only pure sequences are exempt; with the sequence requirements
  met, all valid melds may be exempt. Choose the lowest legal penalty grouping.
- CPU sees own cards, indicator, top discard and public counts. It minimizes
  unmatched cards/penalty subject to required sequences, never inspects stock
  order or opposing hands. CPU saves: `ir.*`; Nearby uses separate
  host-authoritative state and per-seat projections, never CPU save/stat writes.
- Hand arrangement (2026-11-06). The player orders their own hand: drag a card
  to another place, or move the focused card with Shift + ←/→; Sort puts the
  hand back in suit order (the order every hand was shown in before). A drawn
  or picked-up card joins at the right end; a discard closes its gap; a new
  deal, including Retry same board, starts sorted. Cards can be arranged on any
  turn, during the CPU's moves too, because the order changes no card:
  declaring, penalties and the CPU read which cards a hand holds, never where
  they sit, and Suggested groups stays the engine's own grouping. The CPU save
  keeps the order (`ir.saveGame` v2, `handOrder`); a v1 save, or an order that
  no longer lists the hand, resumes sorted. Nearby keeps it on the device for
  the deal on screen and never sends it; the board stays mounted between
  rounds, so it starts a deal sorted when a finished deal is followed by a live
  one, at the deal event, or when the wild indicator changes, never by how many
  cards two hands share. A drag starts after 8px of travel, so a tap still
  selects the discard, and a press that once went further than a tap's reach
  is a drag wherever it is let go, its own place included. During a drag the
  cards keep their DOM order and take places by CSS `order`, because moving
  the pressed card's node would end its pointer capture; the places are read
  with every slide finished, and the card stays under the finger where it was
  taken.
- Collection home/tutorial/resume/results contracts and [card art](CARD_DESIGN.md)
  apply. Landscape uses room for thirteen cards; portrait remains playable.

Reference: [Pagat](https://www.pagat.com/rummy/indian.html).
No-drop single-deal scoring, the natural-card requirement and invalid-declaration
handling are explicit house rules.
