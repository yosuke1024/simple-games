/**
 * The tower's guarantees (docs/BOUNCE_UP_RULES.md §3「不変条件」) over
 * 1,000 seeds × 2 widths × 2,000 segments, and its determinism.
 */
import { describe, expect, it } from 'vitest';
import {
  BOARD_WIDTH,
  CHAIN_DISTANCE_PX,
  CHAIN_SPEED_PERCENT,
  GAP_APEX_PERCENT,
  GAP_MAX_PX,
  MOVING_FROM,
  RUN_SPEED,
  SUB,
  VANISHING_FROM,
} from './constants';
import {
  chainDistance,
  gapRange,
  generateSegment,
  generateTower,
  platformLeft,
  platformWidthPx,
  ramp,
  FLOOR_CURSOR,
} from './generate';
import { airSteps, apexUnits } from './physics';
import { platformToString, report } from './test-helpers';
import type { PlatformWidth } from './types';

const SEEDS = 1000;
const SEGMENTS = 2000;
const WIDTHS: readonly PlatformWidth[] = ['normal', 'wide'];

/** Steps from a bounce to landing `g` px higher, for every legal gap. */
const AIR = Array.from({ length: GAP_MAX_PX.end + 1 }, (_, g) => airSteps(g * SUB));

describe('ramps (§3)', () => {
  it('run linearly from segment 1 to 1500 and then stay', () => {
    expect(gapRange(1)).toEqual({ min: 48, max: 72 });
    expect(gapRange(750)).toEqual({ min: 72, max: 100 });
    expect(gapRange(1500)).toEqual({ min: 96, max: 128 });
    expect(gapRange(99_999)).toEqual({ min: 96, max: 128 });
    expect(chainDistance(1)).toBe(110);
    expect(chainDistance(1500)).toBe(CHAIN_DISTANCE_PX.end);
    for (let i = 1; i < 2000; i++) {
      expect(ramp(48, 96, i + 1)).toBeGreaterThanOrEqual(ramp(48, 96, i));
      expect(chainDistance(i + 1)).toBeGreaterThanOrEqual(chainDistance(i));
    }
  });
});

describe(`invariants over ${SEEDS} seeds × ${WIDTHS.length} widths × ${SEGMENTS} segments (§3)`, () => {
  it('gaps, the safety chain, the speed it needs, kinds by segment, the board', () => {
    const gapCap = Math.floor((GAP_APEX_PERCENT * apexUnits()) / 100);
    let segments = 0;
    let maxGap = 0;
    let maxChainDx = 0;
    /** Worst required speed as units × 1000 per step-share, kept as a fraction num/den. */
    let worstNum = 0;
    let worstDen = 1;
    const kinds = { static: 0, moving: 0, vanishing: 0 };
    let extras = 0;
    let firstMoving = Infinity;
    let firstVanishing = Infinity;
    const failures: string[] = [];
    let failed = 0;
    const t0 = Date.now();
    for (const width of WIDTHS) {
      const w = platformWidthPx(width) * SUB;
      for (let n = 0; n < SEEDS; n++) {
        const seed = `inv-${n}`;
        let cursor = FLOOR_CURSOR;
        for (let k = 0; k < SEGMENTS; k++) {
          const s = generateSegment(seed, width, cursor);
          const check = (ok: boolean): void => {
            if (ok) return;
            failed += 1;
            if (failures.length < 5) failures.push(`${seed}/${width}/${s.segment}`);
          };
          const i = s.segment;
          segments += 1;
          // 1. The gap: inside its range, inside 82 % of the apex.
          const range = gapRange(i);
          check(s.gapPx >= range.min && s.gapPx <= range.max);
          check(s.gapPx * SUB <= gapCap);
          if (s.gapPx > maxGap) maxGap = s.gapPx;
          check(s.chain.top === cursor.chainTop + s.gapPx * SUB);
          // 2. The chain: static, on the board, within the direct bound.
          check(s.chain.kind === 'static');
          check(s.chain.chain);
          check(s.chain.left >= 0 && s.chain.left + w <= BOARD_WIDTH);
          const dx = Math.abs(s.cursor.chainCenterPx - cursor.chainCenterPx);
          check(dx <= chainDistance(i));
          check(dx <= CHAIN_DISTANCE_PX.end);
          if (dx > maxChainDx) maxChainDx = dx;
          // 3. The speed it needs: dx px in AIR[g] steps ≤ 70 % of RUN_SPEED.
          const air = AIR[s.gapPx]!;
          check(air > 0);
          check(dx * SUB * 100 <= CHAIN_SPEED_PERCENT * RUN_SPEED * air);
          if (dx * worstDen > worstNum * air) {
            worstNum = dx;
            worstDen = air;
          }
          // 4–5. The extra: kind by segment, halfway up, on the board at every tick.
          const e = s.extra;
          if (e !== null) {
            extras += 1;
            kinds[e.kind] += 1;
            check(!e.chain);
            check(e.top === cursor.chainTop + Math.floor(s.gapPx / 2) * SUB);
            if (e.kind === 'moving') {
              check(i >= MOVING_FROM);
              if (i < firstMoving) firstMoving = i;
              const m = e.motion!;
              check(m.lo >= 0 && m.span > 0 && m.lo + m.span + w <= BOARD_WIDTH);
              check(m.phase >= 0 && m.phase < 2 * m.span);
            } else {
              check(e.motion === null);
              check(e.left >= 0 && e.left + w <= BOARD_WIDTH);
            }
            if (e.kind === 'vanishing') {
              check(i >= VANISHING_FROM);
              if (i < firstVanishing) firstVanishing = i;
            }
          }
          cursor = s.cursor;
        }
      }
    }
    const worstSpeed = (worstNum * SUB) / worstDen;
    report(
      'segments checked',
      segments,
      `(${SEEDS} seeds × ${WIDTHS.length} widths × ${SEGMENTS})`,
    );
    report('largest gap', `${maxGap} px`, `(cap ${(gapCap / SUB).toFixed(3)} px)`);
    report('largest direct chain distance', `${maxChainDx} px`);
    report(
      'worst speed the chain needs',
      `${worstSpeed.toFixed(1)} px/s`,
      `= ${((worstSpeed / RUN_SPEED) * 100).toFixed(1)} % of ${RUN_SPEED}`,
      `(${worstNum} px in ${worstDen} steps)`,
    );
    report(
      'extras',
      extras,
      `static ${kinds.static} / moving ${kinds.moving} / vanishing ${kinds.vanishing}`,
    );
    report('first moving / vanishing segment seen', firstMoving, firstVanishing);
    report('wall clock (printed only)', `${Date.now() - t0} ms`);
    expect(failures).toEqual([]);
    expect(failed).toBe(0);
    expect(maxGap).toBeLessThanOrEqual(GAP_MAX_PX.end);
    expect(kinds.moving).toBeGreaterThan(0);
    expect(kinds.vanishing).toBeGreaterThan(0);
    expect(worstSpeed * 100).toBeLessThanOrEqual(CHAIN_SPEED_PERCENT * RUN_SPEED);
  }, 120_000);

  it('a moving platform stays on the board and inside its travel at every tick of a period', () => {
    let checked = 0;
    let bad = 0;
    for (let n = 0; n < 20; n++) {
      for (const s of generateTower(`move-${n}`, 'wide', 1200)) {
        const e = s.extra;
        if (e === null || e.motion === null) continue;
        const m = e.motion;
        const period = Math.floor((2 * m.span) / m.speed) + 2;
        for (let t = 0; t <= period; t += 1) {
          const left = platformLeft(e, t);
          if (left < m.lo || left > m.lo + m.span || left + e.width > BOARD_WIDTH) bad += 1;
          // Piecewise linear: one step moves it by the speed, or less at a turn.
          if (Math.abs(platformLeft(e, t + 1) - left) > m.speed) bad += 1;
        }
        checked += 1;
      }
    }
    report('moving platforms swept through a whole period', checked);
    expect(bad).toBe(0);
    expect(checked).toBeGreaterThan(100);
  });
});

describe('determinism (§3「決定性」)', () => {
  it('the same seed and width build the same tower; widths share the heights', () => {
    const a = generateTower('det', 'normal', 800).map((s) => [s.chain, s.extra]);
    const b = generateTower('det', 'normal', 800).map((s) => [s.chain, s.extra]);
    expect(b).toEqual(a);
    const wide = generateTower('det', 'wide', 800);
    const normal = generateTower('det', 'normal', 800);
    expect(wide.map((s) => s.chain.top)).toEqual(normal.map((s) => s.chain.top));
    // …but not the platforms.
    expect(wide.map((s) => platformToString(s.chain))).not.toEqual(
      normal.map((s) => platformToString(s.chain)),
    );
    expect(generateTower('det-2', 'normal', 50).map((s) => s.chain.top)).not.toEqual(
      normal.slice(0, 50).map((s) => s.chain.top),
    );
  });
});
