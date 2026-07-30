import { useSyncExternalStore } from 'react';
import { useSettings } from '../state/SettingsContext';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function osReduced(): boolean {
  // No matchMedia (old webviews, jsdom) → no way to honor the OS preference,
  // so err on the quiet side and skip animations entirely.
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia(QUERY).matches;
}

/**
 * Whether animations should be skipped: the in-app setting or the OS-level
 * preference, whichever asks for less motion.
 */
export function useReducedMotion(): boolean {
  const { settings } = useSettings();
  const os = useSyncExternalStore(subscribe, osReduced, () => true);
  return settings.reducedMotion || os;
}
