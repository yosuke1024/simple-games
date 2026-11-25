# Crazy Eights

Adopted 2026-11-05; implemented for CPU and native Nearby play. Four seats, one ordinary
52-card deck, five cards each. One deal is one game. No reaction timer.

- Match the top discard's rank or the current suit. Any eight may be played;
  the player explicitly chooses the next suit, including when finishing.
- The initial discard cannot be an eight. Start with seat 0. Drawing is allowed
  even with a playable card; draw one card per action and remain on the same
  turn. Play any legal card, or keep drawing until the stock is exhausted.
- Recycle the discard pile except its top when necessary. A pass is allowed
  only when no card can be drawn and no legal play exists. Four consecutive
  passes finish a blocked deal. A play or draw clears the pass count.
- Empty your hand to win. In a blocked deal, the lowest remaining penalty wins
  (ties are shared). Eight=50, court=10, ace=1, other ranks=face value. Scores
  show remaining penalties, not a fictional cash balance.
- CPU uses its own hand, the top discard, declared suit and public counts.
  It keeps eights unless needed and chooses a suit from its remaining cards.
- CPU saves are isolated under `ce.*`. Nearby uses host-authoritative
  actions and receiver-specific projections; no stock, seed or other hand is
  sent. Nearby history never updates CPU statistics or saves.
- The offline home, three-step tutorial, resume, statistics and results follow
  the collection contracts. Card art follows [CARD_DESIGN](CARD_DESIGN.md).
  Portrait and landscape are responsive layouts of the same mounted game.

Reference: [Bicycle](https://bicyclecards.com/how-to-play/crazy-eights/).
The four-pass blocked-deal settlement and discard recycling are explicit house rules.

## Club House

**登録しない**(2026-11-15、[architecture/club.md](architecture/club.md) §14 判断 57。registry の
`challenge` を持たない)。結果画面の数字は 4 席それぞれの残り札の失点で、自分の失点は手札を出し切って
勝てば必ず 0 になる。勝ちの行がみな 0 で並び、同点は先に送った順なので、表は勝った回数を数えるのと
変わらない(勝った回数は熱心さの数 — [PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md)「順位表」)。
結果画面が勝ちどうしを分ける数字を出すようになれば、そのとき考え直す。
