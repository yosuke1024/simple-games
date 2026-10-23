# Three Peaks — canonical rules

2026-10-23. Web beta, not part of the native released collection or Club House.

Rules checked against publisher [Solitaire City: How to Play Tri-Peaks](https://www.solitairecity.com/iPhone/Tri-Peaks.shtml) and its [face-down variant](https://www.solitairecity.com/iPhone/Tri-Peaks_Rules.shtml) on 2026-10-23. This implementation automatically reveals newly uncovered cards and uses no speed bonuses or scoring. It is an independent implementation; no source code or artwork was copied.

## 1. Deal and objective

One standard 52-card deck without jokers. Shuffle using a deterministic uint32 seed and Fisher–Yates (the implementation is the version 1 deal definition). Deal 28 tableau cards into three overlapping peaks: rows of 3, 6, 9 and 10. The other 24 form the stock; turn its first card into the waste immediately, leaving 23 draws. Clear all 28 tableau cards to win. Deals are random; solvability is not guaranteed.

## 2. Legal play

Only a tableau card with both covering cards removed is exposed. The ten bottom cards start exposed. Covered cards are face down. An exposed card may move onto the waste when its rank is one above or below the waste rank. Suit is irrelevant. **Ace wraps: K–A–2 is allowed in either direction.** Equal ranks do not match. The removed card becomes the new waste. A draw turns the next stock card into the waste and is allowed even if a tableau move exists. There is one stock pass, no recycling. A win ends immediately; otherwise the game ends when the stock is empty and no exposed tableau card matches.

## 3. Undo and controls

Undo is free and unlimited, including draws and the move that ended a game. It returns to the exact preceding position without refunding elapsed play time. A win counts once per attempt even after undo, resume and a second completion. Tap an exposed card or the stock. Keyboard: Tab and Enter/Space operate the same visible buttons; arrow keys move between exposed tableau cards, D draws and Ctrl/Cmd+Z undoes. Held state-changing keys do not repeat. Input is disabled behind confirmation/result overlays. The header opens RestartDialog with Retry same board (same shuffled deal) and New Game (fresh seed). Either asks before replacing an unfinished deal; from a result both start directly. Retry begins a new attempt, resets the move history and counted-win marker, and increments games played. Home preserves the unfinished game.

## 4. Screens and lifecycle

Home, at most three Quick Rules steps, game and statistics. Home uses GameHomeHeader and the shared Web beta notice. First tutorial completion enters play or resumes an existing deal. Tutorial Back marks it read. The result states either that all cards were cleared or that no moves remain, shows cards left, and offers Undo, New Game, Home and optional ShareAction. Only a win shares `completed`; a stuck game shares `played`. ResultAdSlot sits outside the board. No game guide is linked until one exists.

The play clock is for local statistics only. It counts visible play while the game screen is active, with no React render per second. Background, Home, collection exit and unmount book only unbooked seconds and save. Listeners and timers are released on unmount. A shortcut may resume the sole unfinished deal after Quick Rules have been read.

## 5. Persistence

Version 1, game-owned `tp.saveGame`, `tp.stats`, `tp.flags`. One resume slot; no daily mode. The save stores seed and at most 51 actions, elapsed seconds, a counted-win marker and savedAt. Loading replays every action through legal rules and rejects impossible actions, invalid seeds/clocks, unsupported versions and already finished positions. Invalid data is not deleted by reads. Backup uses the same schemas. Saving failure never blocks play. Unlimited undo survives a reload because the move history is retained.

Statistics are games started, wins, fewest cards left in a finished attempt, and total active play seconds. Starting a new deal or retry increments games; resume does not. Undo never subtracts a win and cannot award a second win for that attempt. A better finish after undo may improve fewest remaining. Completing a same-deal retry is a separate attempt and may award another win.

## 6. Presentation and localization

Cards use rank plus suit symbols; red and black are supplementary. Face-down cards do not reveal rank through their accessible names, face artwork or suit-colour classes. Exposed cards announce position, rank, suit and whether they can move. Cards have a traditional 5:7 proportion, original SVG suit marks and a symmetric geometric back. A subtle framed tableau separates the peaks from the stock/waste/undo rail. Playable cards have an accent edge and dot, with a distinct keyboard focus outline. The layout uses CSS percentages; its ten-card row gives each card a 26px-wide target at a 320px viewport. A scrolling play area keeps controls reachable on short screens. English is source. Japanese and the other 12 translations are AI-written drafts; neither author/native review nor independent back-translation has occurred. Numeric/card-rule literals and placeholders are consistent across 14 catalogs. No high-risk shared policy keys are added.

Red suit content colours are `#9f2634` on light surface `#fffdf8` and `#ef9ba1` on dark surface `#212730`. WCAG relative-luminance calculations give 7.38:1 and 7.06:1 respectively. Card suit symbols also identify suits without colour. The title accent is owned by the shared brand palette.

No real-device checks, trademark clearance or independent translation audit are claimed. Automated checks are recorded with the implementation delivery; browser verification is performed during integration.

Implementation checks on 2026-10-23: 18 Vitest tests passed across engine, persistence and UI lifecycle, with scoped ESLint passing. These cover a 47-action winning fixture, complete undo, exhausted stock with a legal move, corrupt saves, shortcut resume, clock cleanup, confirmation isolation, a win counted once after undo/reload, and same-deal replay as a new attempt. A separate pure-engine run checked 1,000 unique 52-card deals and the complete winning-fixture undo chain. Whole-app types, structural gates, builds and browser checks are integration responsibilities.
