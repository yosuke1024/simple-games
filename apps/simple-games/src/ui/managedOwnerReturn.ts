/** A one-shot route hint for the Web reload that stops an already loaded ad SDK. Never a key. */
const RETURN_KEY = 'sg.managed-owner-return';

export function markManagedOwnerReturn(): void {
  try {
    sessionStorage.setItem(RETURN_KEY, '1');
  } catch {
    // Storage can be unavailable; the durable owner credential remains in sg.club.
  }
}

export function consumeManagedOwnerReturn(): boolean {
  try {
    const marked = sessionStorage.getItem(RETURN_KEY) === '1';
    sessionStorage.removeItem(RETURN_KEY);
    return marked;
  } catch {
    return false;
  }
}
