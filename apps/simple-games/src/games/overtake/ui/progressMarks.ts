/**
 * Where the progress strip's rings sit (docs/OVERTAKE_RULES.md §11「着順と進行バー」).
 *
 * Each of the three others wants the spot its progress puts it at, but the
 * rings carry their digit and must not cover one another: all three start
 * level, and the paces differ by under a tenth (§6), so they bunch up for
 * most of a race. `spreadMarks` keeps every pair at least `gap` apart, keeps
 * their order along the course (a tie goes by digit), keeps them on the track,
 * and moves them as little as it can: a bunch is laid out at even spacing
 * around where its members want to be on average. Pure, so it is tested
 * without a layout (jsdom has none).
 */

/** A ring's width, CSS px (ui/overtake.css `.ot-progress-rival`). */
export const RIVAL_MARK_PX = 16;

/** The track's width on a 360-wide screen, used until the strip has been measured. */
export const FALLBACK_TRACK_PX = 166;

interface Member {
  readonly x: number;
  readonly index: number;
}

interface Bunch {
  members: Member[];
  start: number;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function place(bunch: Bunch, width: number, gap: number): void {
  const k = bunch.members.length;
  let sum = 0;
  bunch.members.forEach((m, j) => {
    sum += m.x - j * gap;
  });
  bunch.start = clamp(sum / k, 0, Math.max(0, width - (k - 1) * gap));
}

/**
 * Positions, px from the track's start, for marks that want to be at
 * `desired` (px) on a track `width` px long. Index for index with `desired`.
 */
export function spreadMarks(desired: readonly number[], width: number, gap: number): number[] {
  const order: Member[] = desired
    .map((x, index) => ({ x: clamp(Number.isFinite(x) ? x : 0, 0, width), index }))
    .sort((a, b) => a.x - b.x || a.index - b.index);
  const bunches: Bunch[] = [];
  for (const member of order) {
    const bunch: Bunch = { members: [member], start: 0 };
    place(bunch, width, gap);
    bunches.push(bunch);
    // Merge back while the newest bunch crowds the one before it.
    while (bunches.length > 1) {
      const last = bunches[bunches.length - 1]!;
      const prev = bunches[bunches.length - 2]!;
      const prevEnd = prev.start + (prev.members.length - 1) * gap;
      if (last.start - prevEnd >= gap - 1e-9) break;
      prev.members.push(...last.members);
      bunches.pop();
      place(prev, width, gap);
    }
  }
  const out = new Array<number>(desired.length).fill(0);
  for (const bunch of bunches) {
    bunch.members.forEach((m, j) => {
      out[m.index] = bunch.start + j * gap;
    });
  }
  return out;
}
