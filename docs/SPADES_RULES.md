# Spades

Adopted 2026-11-05; implemented for CPU and native Nearby play. Four seats, partners opposite
(0+2 and 1+3), ordinary 52-card deck. Short match to 200 points; explain the
target on the home and table. No blind nil or reaction timer.

- Deal thirteen each. Bidding and the first lead begin left of the dealer;
  dealer rotates between hands. Each seat bids 0 (nil) through 13 in order.
- Follow suit when possible. Highest spade wins a trick containing spades;
  otherwise highest of the led suit wins. Ace high. Winner leads next.
- Spades cannot be led until a spade was played off-suit, unless the leader
  has only spades. Thirteen tricks complete a hand.
- Partnership contract is the sum of non-nil bids; only tricks taken by those
  bidders meet that contract. Made contract: 10×bid plus 1 per overtrick;
  failed contract: −10×bid. Nil separately earns +100 for zero tricks or −100.
  Tricks taken by a nil bidder count as bags, not toward the partner's bid;
  each is +1 and advances the bag count. Every ten accumulated bags cost 100,
  retaining the remainder. With both nil, base contract scoring is zero.
- At a hand boundary, a team at 200+ wins if ahead of the other. Equal totals
  continue. Show the completed hand before explicit continuation of the next
  hand by seat 0 (the host in Nearby). No automatic disappearance of the trick or score explanation.
- CPU chooses bids and cards from its own hand and public tricks/bids only.
- CPU saves: `sa.*`. Nearby is four fixed seats with people/CPU mix and
  host validation. Only the receiver's hand is projected. Save/stat boundaries,
  home/tutorial/results and [card art](CARD_DESIGN.md) follow collection policy.
  Responsive landscape preserves the current trick and selected card.

Reference: [Pagat](https://www.pagat.com/auctionwhist/spades.html).
The 200-point target and nil-bag treatment are explicit house rules.
