/**
 * The production board seed. A level is a promise: every player, and the same
 * player across app updates, must see the same wall (docs/BRICK_BREAKER_RULES.md
 * §1). Changing this string moves every board — the golden test makes that a
 * decision instead of an accident.
 */
export const BOARD_SEED = 'brick-breaker-v1';

export const BOARD_WIDTH = 360;
export const BOARD_HEIGHT = 640;

export const PADDLE_HEIGHT = 12;
export const PADDLE_Y = BOARD_HEIGHT - 36;
export const PADDLE_SPEED = 420;

export const BALL_RADIUS = 6;

// Center hit sends the ball straight up; a hit at the paddle's edge deflects
// it by this many radians (~60deg) so aiming near an edge is a real choice.
export const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180;

export const STARTING_LIVES = 3;

/**
 * Extra balls are the one way the player gets stronger, and they work the
 * mirror of Sky Fighter's barrels: earned in play, free, capped, gone when the
 * level ends. Losing one costs a ball, not a life — only the last ball does.
 */
export const MAX_BALLS = 3;

export const BRICK_COLUMNS = 8;
export const BRICK_GAP = 4;
export const BRICK_HEIGHT = 20;
export const BRICK_TOP = 48;
export const BRICK_ROWS_MAX = 7;

/**
 * The wall creeps down while you play. Let a brick touch this line and the
 * level is lost — which is why a board can never be stalled.
 *
 * This is pressure without a clock: no countdown, no timer, nothing displayed
 * but the board itself. The brand forbids artificial urgency (streaks, energy,
 * limited-time events), not the pacing of an action game — and a wall you can
 * see is more honest than a number counting down.
 */
export const DESCENT_LINE_Y = PADDLE_Y - 28;
