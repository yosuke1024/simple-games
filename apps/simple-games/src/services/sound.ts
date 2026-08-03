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

export const sounds = {
  select(): void {
    tone(523, 45);
  },
  match(): void {
    tone(523, 60);
    tone(659, 90, 55);
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
  clear(): void {
    tone(523, 90);
    tone(659, 90, 90);
    tone(784, 160, 180);
  },
  gameOver(): void {
    tone(330, 120, 0, 0.03);
    tone(262, 180, 130, 0.03);
  },
};
