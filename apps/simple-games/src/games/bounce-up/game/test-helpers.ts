/**
 * Helpers shared by the game/ tests (not imported by the app). Measured
 * numbers are printed with `report` so a run shows what the rules document
 * quotes (docs/BOUNCE_UP_RULES.md §10, §11).
 */
import { SUB } from './constants';
import { createRun, start } from './physics';
import type { Platform, PlatformKind, RunState, StepInput } from './types';

/** FNV-1a, 32-bit, folded over strings one at a time — integer ops only. */
export class Fnv {
  private h = 0x811c9dc5;
  add(text: string): this {
    for (let i = 0; i < text.length; i++) {
      this.h ^= text.charCodeAt(i);
      this.h = Math.imul(this.h, 0x01000193);
    }
    return this;
  }
  hex(): string {
    return (this.h >>> 0).toString(16).padStart(8, '0');
  }
}

export function fnv1a(text: string): string {
  return new Fnv().add(text).hex();
}

/** Prints a measured line into the test output. */
export function report(label: string, ...values: unknown[]): void {
  process.stdout.write(`[bounce-up] ${label}: ${values.join(' ')}\n`);
}

export function platformToString(p: Platform): string {
  const m =
    p.motion === null ? '' : `~${p.motion.lo}/${p.motion.span}/${p.motion.speed}/${p.motion.phase}`;
  return `${p.id}:${p.kind[0]}${p.chain ? 'c' : ''}@${p.top}/${p.left}/${p.width}${m}`;
}

/** One step of a trace as text: the body, the camera, the event. */
export function stepToString(s: RunState): string {
  return `${s.tick}|${s.x}|${s.y}|${s.vy}|${s.target}|${s.cameraBottom}|${s.event}`;
}

/** A gen cursor far above anything a test reaches: no generation, ever. */
const NO_GEN = { next: 1_000_000, chainTop: Number.MAX_SAFE_INTEGER, chainCenterPx: 180 };

export function px(n: number): number {
  return n * SUB;
}

export function plat(
  id: number,
  topPx: number,
  leftPx: number,
  widthPx = 64,
  kind: PlatformKind = 'static',
): Platform {
  return {
    id,
    segment: id,
    kind,
    chain: kind === 'static',
    top: px(topPx),
    left: px(leftPx),
    width: px(widthPx),
    motion: null,
  };
}

/**
 * A running state on a hand-built board: the given platforms (sorted by
 * height), no generation, body and camera as given.
 */
export function board(platforms: Platform[], over: Partial<RunState> = {}): RunState {
  const base = start(createRun('test-board', 'normal'));
  const sorted = platforms.slice().sort((a, b) => a.top - b.top);
  return { ...base, platforms: sorted, gen: NO_GEN, ...over };
}

/** Run-length input: [steps, drag per step, dir] triples. */
export function expandInputs(runs: readonly (readonly [number, number, number])[]): StepInput[] {
  const out: StepInput[] = [];
  for (const [n, drag, dir] of runs) for (let k = 0; k < n; k++) out.push({ drag, dir });
  return out;
}

/** Every number reachable in a value (objects, arrays), for the integer-only checks (§2). */
export function collectNumbers(value: unknown, out: number[] = []): number[] {
  if (typeof value === 'number') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectNumbers(v, out);
  } else if (typeof value === 'object' && value !== null) {
    for (const v of Object.values(value)) collectNumbers(v, out);
  }
  return out;
}
