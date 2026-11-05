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
