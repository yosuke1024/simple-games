# Nim — rules and implementation

**2026-10-25 更新:** nativeの「誰かと遊ぶ」を追加。以下のCPU専用の操作・Undo・保存の記述は通常モードに適用し、近隣対戦は末尾の節を正とする。
オーナーの「13本すべてをアプリに収録する」に従い、Webベータから正式収録へ変更し保存スキーマを凍結する。以下の旧ベータ段階の記録は履歴であり、2週間の安定稼働や実機検証を達成した意味ではない。

Updated: 2026-10-23. Web early release. Canonical rules for this implementation.

## Play

Four visible heaps contain stones. You move first. Select exactly one nonempty row,
choose a number from 1 to all its stones, then confirm. The CPU does the same.
Taking the last stone wins (normal play, not misère). There is no timer or score.
Each seeded starting position has 2–8 stones per heap (one may become 1 to remove
an xor-zero position). Its xor is nonzero: every game has a winning strategy for
the human, including Hard. This is a puzzle-like strategic game against a CPU,
not a claim of equal winning chances under perfect play.

## CPU and undo

Easy chooses a seeded legal move. Normal chooses the optimal xor move on 70% of
turns when one exists; otherwise a seeded legal move. Hard always chooses an xor-zero
reply when available. There is no tree search; at most 32 legal removals are considered.
The reply uses one 450 ms effect-owned timer. Leaving, restarting, undoing, opening
the restart confirmation, hiding the page or native pause cancels it. A backgrounded
CPU turn requires Resume after returning, rather than resuming automatically.
Undo returns to the previous human decision, including both human and CPU moves,
and remains available after either result. No cost or quota.

## Screens, accessibility, and persistence

Home, three illustrated Quick Rules, game and statistics. Home remembers difficulty;
replacing an unfinished game asks first. The game has labelled row buttons and a
number control, with native keyboard activation and Ctrl/Cmd+Z for Undo. Selection
alone never removes stones. Result offers Undo, new game, home, optional ShareAction,
and the shared result ad placement. Reduced motion follows shared UI.

The `ni.` namespace has `saveGame`, `stats`, `flags`, `prefs` schema version 1.
The saved move list replays from seed and difficulty; illegal moves, out-of-range
values, oversized lists and finished saves are rejected. Undo history survives reload.
Only one slot exists; no daily. Statistics count starts and the first completed result
of each match by difficulty, plus total active seconds. Undo after a result permits
exploration but never counts the same match twice; that marker survives a saved undo.
A resumed match's elapsed and booked clocks share the saved baseline. Writes use
shared serialized persistence, including hide, native pause and unmount.

## Release evidence

English source copy plus Japanese and all 12 additional app locales are AI-authored
drafts on 2026-10-23. No human linguistic approval is claimed. Tests cover rules,
optimal play, deterministic CPU decisions, save replay and corruption, actual UI
controls, shortcut resume, hide/resume and timer cleanup. Physical device and human
translation review remain unperformed. Title/store/trademark review is not claimed.

Automated local check on 2026-10-23: the scoped Nim + Knight’s Tour run passed
6 test files / 31 tests. Nim includes 1,000 starting seeds solved by optimal human
play against Hard, all three CPU modes over 200 seeds, storage isolation, live CPU
cancellation/resume, terminal undo, clock booking at save/unmount, and resource cleanup.
These Node/jsdom checks are not a physical-device performance measurement.

## Visual refinement (2026-10-23)

The heaps are four flat rows of uniform slim counters, without bevels or shadows.
Selected removals become outlined, struck counters; the control tray also shows
`before − taken = after`. Eight count choices stay in a fixed two-by-four grid;
counts beyond the selected row are disabled. Take and Undo share one compact row.
The title, turn/difficulty strip, board and controls fit above the Web ad reserve on
360×740, while short screens retain scrolling. This changes presentation, not rules,
CPU choices or the persisted schema.

## Nearby Play（2026-10-25）

hostを先手とする。CPU戦と同じ4山の初期配置生成を使うため、完全最善手では先手が勝てる配置であり、公平な勝率を保証するものではない。最後の石を取った側が勝つ。`NimPlaySurface`をCPU戦と共有し、山選択→個数→確認で進める。得点は無く、履歴にも仮の0点を出さない。

ゲームtopの「誰かと遊ぶ」→募集／参加→host承認→双方Ready→同じ盤面・操作へ進む。
ゲームは集まりの終了まで固定。一方的なUndoは設けず、終局後は双方Readyで再戦する。
募集時のチャット有無は既定OFFで双方へ適用し、ONだけ会話ボタン・未読印・端末内会話履歴を使う。
ゲームtopへ戻る操作やアプリ切替では明示終了せず、一時切断後は同じ相手と保持した局面から続ける。
プロセス終了からの復元は未対応。結果・中断はNearby専用のローカル履歴に残し、
通常CPU戦のセーブ・統計・Club送信・バックアップには混ぜない。
技術と通信の正本は[nearby-multiplayer.md](architecture/nearby-multiplayer.md)。今回の実機検証は未実施。
