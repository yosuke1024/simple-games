# Blackjack

Adopted 2026-11-05; implemented for CPU and native Nearby play. Four player seats around an
automatic dealer. Each player plays against the dealer, not against the others.
One round is one game. Six standard decks, shuffled anew for each game.
No reaction timer, betting currency, cash stakes, purchases or ad-gated refills.

- Fixed stake of 10 round points per initial hand. Deal two cards per player
  and two to dealer, with one dealer card hidden. Ace counts as 1 or 11;
  court cards as 10. Natural blackjack pays +15 (3:2), ties dealer natural push.
- Dealer peeks under an ace/ten-valued upcard. Dealer natural ends the round
  immediately; no splitting/doubling against a known dealer natural.
- Hit or stand; double on any first two cards, including after a split, for
  exactly one further card and a doubled stake. Split identical ranks into
  two hands, up to four hands per seat; re-splitting non-aces is allowed.
  Split aces receive one card each and stand; no re-splitting aces. A 21 after
  splitting is ordinary 21, not a natural. No insurance or surrender.
- Finish all hands for one seat before advancing clockwise. Bust loses even
  if dealer later busts. Dealer draws below 17 and stands on all 17s, including
  soft 17. Dealer draws only if an undecided ordinary player hand remains.
- Resolve each hand separately: win +stake, loss −stake, push 0. Show net
  points and each hand's outcome. Multiple players may win; do not fabricate
  a single table winner. Rematch starts an independent equal-stake round.
- CPU basic decisions use only own cards and dealer upcard. Hidden dealer
  card, shoe and other private hands never enter its decision input.
- CPU saves: `bj.*`. Nearby presents the same round with four people/
  CPU seats. Player hands are private until settlement; dealer hole card is
  hidden until settlement. Group results preserve per-seat scores and no
  invented exclusive winner. CPU and Nearby records remain separate.
- Home/tutorial/resume/stats/results use collection contracts; both orientations
  and original artwork follow [CARD_DESIGN](CARD_DESIGN.md).
- Simulated-gambling content must be reflected in store metadata. Free points
  do not remove that classification; this is not a store-publication approval.

Reference: [Bicycle](https://bicyclecards.com/how-to-play/blackjack/).
