/**
 * Vibration feedback via Capacitor Haptics. Optional by setting; failures
 * (e.g. web platform without support) are silently ignored.
 */
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

let enabled = true;

export function setVibrationEnabled(value: boolean): void {
  enabled = value;
}

async function safely(run: () => Promise<unknown>): Promise<void> {
  if (!enabled) return;
  try {
    await run();
  } catch {
    // Haptics must never break the game.
  }
}

export const haptics = {
  tap: (): Promise<void> => safely(() => Haptics.impact({ style: ImpactStyle.Light })),
  match: (): Promise<void> => safely(() => Haptics.impact({ style: ImpactStyle.Medium })),
  invalid: (): Promise<void> =>
    safely(() => Haptics.notification({ type: NotificationType.Warning })),
  clear: (): Promise<void> =>
    safely(() => Haptics.notification({ type: NotificationType.Success })),
};
