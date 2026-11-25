# Durak

Adopted 2026-11-05; implemented for CPU and native Nearby play. Two-player, non-transferable
throw-in Durak, 36 cards (6–A in each suit), six cards each. No reaction timer.

- The face-up bottom stock card determines trump and is drawn last. The holder
  of the lowest trump in their dealt hand attacks first; seat 0 if neither has one.
- Attack with one card. Defender beats it with a higher card of its suit, or
  any trump against a non-trump. A trump can only be beaten by a higher trump.
- After every defense the attacker may finish the attack or add a card whose
  rank appears anywhere on the table. At most six attacks, also capped by the
  defender's hand size at the start of the bout. These choices are sequential.
- Defender may choose pickup instead of defending. Attacker can then throw in
  matching ranks up to the same cap before confirming pickup. No transfer.
- Successful defense discards the table; the defender attacks next. Pickup
  adds the whole table to the defender's hand; the attacker attacks again.
  Refill to six from stock, attacker first, then defender.
- Once stock is empty, a player with no cards is out. The other player is the
  durak. If both empty on the same completed bout, draw. No early victory before
  the current bout and refill are resolved.
- CPU sees its own hand, table, public trump, stock count and opposing hand
  count. It does not read the stock order or opponent's hand.
- Isolated CPU saves: `du.*`. Nearby actions are host-authoritative;
  per-seat projections omit hidden cards and seed. CPU and Nearby records stay
  separate. Use the normal home/tutorial/resume/stats/results contracts and
  [shared card art](CARD_DESIGN.md), with both orientations supported.

Reference: [Pagat](https://www.pagat.com/beating/podkidnoy_durak.html).

## Club House

正典は [architecture/club.md](architecture/club.md) §6-0 と §14 の判断 57。

- **登録しない**(registry の `challenge` を持たない。2026-11-15、判断 57)。結果は勝ち / 負け(durak)/ 引き分け
  だけで、この規則は得点を定めない。結果画面の数字は各席に残った札の枚数で、山札が尽きたあと手札を出し切った側が
  勝つので、勝った側は必ず 0 枚、負けた側の枚数は終わったときの手札の残りにすぎない。共有の `details` も空で、
  送れる成績の数字が無い。表が比べられるのは勝った回数だけになり、それは熱心さの数である
  ([PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md)「順位表」。判断 30 の Checkers / Connect Four / Gomoku / Ludo と同じ理由)。
- 入るには、結果画面が勝敗のほかに成績を比べられる数字を出すことが要る(club.md §6-0)。
