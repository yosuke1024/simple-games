/**
 * Sound effects synthesized with WebAudio — no audio assets to download,
 * fully offline. Quiet, short tones that fit the calm design language.
 * Every call is failure-tolerant.
 */

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(value: boolean): void {
  enabled = value;
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
