/**
 * Sound effects synthesized with WebAudio — no audio assets to download,
 * fully offline. Quiet, short tones that fit the calm design language.
 * Every call is failure-tolerant.
 */

let ctx: AudioContext | null = null;
let enabled = true;
let idleSuspendTimer: number | null = null;

/** Battery: a running AudioContext keeps audio hardware awake. */
const IDLE_SUSPEND_MS = 30_000;

function suspendContext(): void {
  try {
    if (ctx && ctx.state === 'running') void ctx.suspend();
  } catch {
    // Ignore.
  }
}

function scheduleIdleSuspend(): void {
  if (typeof window === 'undefined') return;
  if (idleSuspendTimer !== null) window.clearTimeout(idleSuspendTimer);
  idleSuspendTimer = window.setTimeout(suspendContext, IDLE_SUSPEND_MS);
}

// Suspend immediately when the app goes to background.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') suspendContext();
  });
}

export function setSoundEnabled(value: boolean): void {
  enabled = value;
  if (!value) suspendContext();
}

/**
 * Leaving a game quiets the hardware now, not 30 seconds from now: the shell
 * calls this on exit (docs/GAME_LIFECYCLE.md). The context itself survives —
 * it is a process-wide singleton and the next game's first tone resumes it —
 * but no game may leave audio work running behind the collection home.
 */
export function releaseSound(): void {
  if (idleSuspendTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(idleSuspendTimer);
    idleSuspendTimer = null;
  }
  suspendContext();
}

function getContext(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? null;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(frequency: number, durationMs: number, delayMs = 0, gainValue = 0.035): void {
  if (!enabled) return;
  try {
    const audio = getContext();
    if (!audio) return;
    const start = audio.currentTime + delayMs / 1000;
    const stop = start + durationMs / 1000;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(gainValue, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, stop);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(stop + 0.02);
    scheduleIdleSuspend();
  } catch {
    // Sound must never break the game.
  }
}

/**
 * A ladder of pitches for feedback that has a "how much": a major pentatonic
 * over two octaves, in semitones above the base tone. Any two rungs sound
 * fine together, so a run of steps never lands on a sour interval. The top
 * rung is a ceiling, not an error — a twelfth tube, a 4096 tile, a streak
 * past the ladder all sit on the same highest note.
 *
 * The step is information the player already has (tubes finished, lines
 * cleared, the tile just made, the run of matches) said again in pitch. It is
 * never a countdown and never a warning: nothing here gets faster or louder,
 * only higher (docs/PRODUCT_PRINCIPLES.md「急かさない」).
 */
const LADDER: readonly number[] = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

/** The base frequency raised `step` rungs up the ladder (clamped). */
function rung(base: number, step: number): number {
  const index = Math.min(LADDER.length - 1, Math.max(0, Math.floor(step)));
  return base * 2 ** (LADDER[index]! / 12);
}

/** Every step is a whole rung, so the clamp is what tests can rely on. */
export const SOUND_STEP_MAX = LADDER.length - 1;

export const sounds = {
  select(): void {
    tone(523, 45);
  },
  /**
   * A match, a merge, a finished tube, a correct digit. `step` (0 = base)
   * lifts the pair of tones up the ladder: the fourth tube sorted rings
   * higher than the first, the 256 tile higher than the 8, and a row of
   * matches climbs as it goes.
   */
  match(step = 0): void {
    tone(rung(523, step), 60);
    tone(rung(659, step), 90, 55);
  },
  invalid(): void {
    tone(196, 90, 0, 0.025);
  },
  addNumbers(): void {
    tone(392, 60);
    tone(440, 70, 60);
  },
  undo(): void {
    tone(440, 50);
  },
  /**
   * A clear: a line, a board, a level. `count` is how many things cleared at
   * once (1 = the plain arpeggio). Two or more lift the arpeggio a rung per
   * extra line and let its three notes ring together at the end — a chord,
   * because two lines at once is one event and not two clears in a row.
   */
  clear(count = 1): void {
    const step = Math.max(0, Math.floor(count) - 1);
    const root = rung(523, step);
    const third = rung(659, step);
    const fifth = rung(784, step);
    tone(root, 90);
    tone(third, 90, 90);
    tone(fifth, 160, 180);
    if (count >= 2) {
      tone(root, 220, 180, 0.022);
      tone(third, 220, 180, 0.022);
    }
  },
  gameOver(): void {
    tone(330, 120, 0, 0.03);
    tone(262, 180, 130, 0.03);
  },
};
