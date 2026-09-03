/** Formats seconds as m:ss or h:mm:ss. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

/**
 * Typographic minus, so a difference reads as a sign and not a dash. Screen
 * readers voice it as "minus", which is what it is.
 */
const MINUS = '−';

/** A difference in seconds, signed: `+0:18`, `−0:05`. Zero is `±0:00`. */
export function formatSignedDuration(deltaSeconds: number): string {
  const rounded = Math.trunc(deltaSeconds);
  const sign = rounded < 0 ? MINUS : rounded > 0 ? '+' : '±';
  return `${sign}${formatDuration(Math.abs(rounded))}`;
}

/** A difference in whole units (moves, points), signed: `+120`, `−3`. */
export function formatSignedCount(delta: number): string {
  const rounded = Math.trunc(delta);
  const sign = rounded < 0 ? MINUS : rounded > 0 ? '+' : '±';
  return `${sign}${Math.abs(rounded)}`;
}
