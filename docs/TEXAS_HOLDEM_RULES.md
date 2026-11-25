# Texas Hold'em

Withheld from the iOS app from 1.8.5 — no public iOS release has offered it (Android app and Web version only) —
[PRODUCT_PRINCIPLES](PRODUCT_PRINCIPLES.md)「iOS で出さないタイトル」 (App Review 2.3.6; iOS 1.8.4 rejected 2026-11-10).
The code stays in the bundle and the `th.*` keys stay registered on every platform.

Adopted 2026-11-05 following the owner's explicit format selection;
implemented for CPU and native Nearby play (offered on Android only). Four-seat no-limit Hold'em, ordinary 52-card deck.
Each new game starts with 1,000 free table chips per seat, fixed blinds 10/20.
Chips are game state, never purchased, redeemed, replenished by ads or carried
as currency between games. No ante, rake, timed blinds, reaction timer or rebuy.

- Advance the big blind among surviving seats; the dealer button may occupy
  an empty seat after elimination (dead button). With three or more players,
  blinds are the next two live seats; preflop starts left of the big blind.
  Heads-up dealer posts small blind and acts first preflop, last postflop.
  Adjust the button on entering heads-up so the big blind does not repeat.
- Two private cards; burn then flop (3), burn then turn (1), burn then river
  (1). Best five of seven wins. Standard high hands; ace-low straight allowed,
  no wraparound. Ties split pots. No joker or five of a kind.
- Fold, check, call, raise to a total, or all-in. Minimum full raise equals the
  previous full raise (initially big blind); opening bet minimum is 20.
  A short all-in is legal but does not by itself reopen a previous actor's
  raising. Cumulative short raises reopen when the actor faces a full raise
  since their last action. Never require an all-in player to act again.
- Every non-folded player must match the current bet or be all-in, and each
  player still able to act must have acted, before the next street. If fewer
  than two players can still bet, finish outstanding calls/folds, then run out
  the board. An uncalled contribution is returned before distributing pots.
- Side pots use actual total contributions, including folded contributions;
  only non-folded contributors are eligible. Odd chips go clockwise from the
  button among tied winners. Reveal live hands at showdown; folded private
  cards remain private. An uncontested pot does not expose the winner's hand.
- Show hand payouts before explicit continuation by seat 0 (the host in Nearby),
  even if that seat has already lost its chips. Eliminate zero-chip seats
  between hands. One remaining player wins the table; a new game resets all
  seats equally. CPU uses own hole cards, community cards and public actions,
  never opponent hole cards or the undealt deck.
- CPU saves: `th.*`. Nearby uses four fixed seats and receiver-
  specific projections. New arrivals wait for the table game to finish.
  Landscape/portrait and artwork follow [CARD_DESIGN](CARD_DESIGN.md).
- Poker is simulated gambling despite free chips. Store age/content metadata
  must describe it accurately; implementation is not store-publication approval.

Reference: [Bicycle](https://bicyclecards.com/how-to-play/texas-holdem-poker).

Betting and blind reference: [Poker TDA 2026 rules 21, 23, 34–36, 45 and 49](https://www.pokertda.com/view-poker-tda-rules/).

## Club House

正典は [architecture/club.md](architecture/club.md) §6-0 と §14 の判断 57。

- **登録しない**(registry の `challenge` を持たない。2026-11-15、判断 57)。結果は卓に最後に残った 1 席が
  あなたかどうか — 勝ち / 負け — だけである。結果画面の数字は各席のチップと最後のハンドの配当で、チップは卓の外へ
  出入りしない(4 席 × 1,000、アンティもレーキも無い)ので、勝てば必ず 4,000、負ければ 0 になる。共有の `details`
  も空で、送れる成績の数字が無い。表が比べられるのは勝った回数だけになり、それは熱心さの数である
  ([PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md)「順位表」。判断 30 の Checkers / Connect Four / Gomoku / Ludo と同じ理由)。
- 入るには、結果画面が勝敗のほかに成績を比べられる数字を出すことが要る(club.md §6-0)。
