/**
 * This game's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts.
 *
 * Provenance (docs/OVERTAKE_RULES.md §12, docs/I18N_POLICY.md「来歴」): this
 * is the source, written 2026-10-21. Every other catalog is measured against
 * it.
 *
 * Wording (§12): "Place", never rank, ranking or leaderboard; "Bumps" for
 * contacts, never a crash; the three other racers are "cars running at their
 * own pace", never rivals, opponents or a "pace car" (a safety car that leads
 * the field, not one that races it). Headings state facts — no praise, no
 * "lost". Every variable part is a `{var}`, never a sentence glued together
 * in code. Nothing here promises anything about money, ads, the network, or
 * what is kept or deleted.
 */
export const en = {
  overtakeName: 'Overtake',

  // Home
  overtakeControls: 'Controls',
  overtakeControlsDrag: 'Drag',
  overtakeControlsButtons: 'Buttons',

  // The game screen
  overtakeStart: 'Start',
  overtakePause: 'Pause',
  overtakeTouchToStart: 'Touch to start',
  overtakePaused: 'Paused',
  overtakePlaceNow: 'Place {place} of 4',
  overtakeBoardLabel: 'Overtake, level {n}: {state}',
  overtakeState_ready: 'ready',
  overtakeState_running: 'running',
  overtakeState_paused: 'paused',
  overtakeState_finished: 'finished',
  overtakePad: 'Driving buttons',
  overtakeSteerLeft: 'Steer left',
  overtakeSteerRight: 'Steer right',
  overtakeSlowDown: 'Ease off',

  // The finish
  overtakeLiveResult: 'Place {place} of 4. Bumps {bumps}.',
  overtakeResultCleared: 'Level {n} cleared',
  overtakeResultPlaced: 'Level {n} — {place}',
  overtakePlace: 'Place',
  overtakeBumps: 'Bumps',

  // Quick Rules (§10): one sentence each; step 2 says the control in use.
  overtakeStep1Title: 'Change lanes',
  overtakeStep1Body:
    'Move the car left and right to change lanes — the throttle is automatic, so it speeds up on its own.',
  overtakeStep2Title: 'Ease off',
  overtakeStep2BodyDrag:
    'Where traffic is tight, pull your finger down to ease off — a bump stops you, so easing off is faster.',
  overtakeStep2BodyHold:
    'Where traffic is tight, hold ▼ to ease off — a bump stops you, so easing off is faster.',
  overtakeStep3Title: 'Finish first',
  overtakeStep3Body:
    'Cross the line ahead of the three cars running at their own pace, and the next level opens.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type OvertakeMessages = Record<keyof typeof en, string>;
