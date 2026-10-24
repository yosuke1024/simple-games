/** Web-only lifetime of SDKs that cannot be unloaded from a live document. */
import {
  isAdRemovalActive,
  isManagedOwnerAdRemovalActive,
  isManagedOwnerAdRemovalPersisted,
  subscribeAdRemoval,
} from '../../../monetization/adRemoval';
import { markManagedOwnerReturn } from '../../../ui/managedOwnerReturn';

let unsubscribe: (() => void) | null = null;
let networkStarted = false;
let reloadRequested = false;
let reload = () => window.location.reload();
const SUPPRESSION_STYLE = 'sg-ad-removal-style';

function hideWebAds(): void {
  delete document.documentElement.dataset.sgWebAds;
  document.querySelectorAll('.web-anchor-test, .web-admax-anchor').forEach((bar) => bar.remove());
  // Google owns its automatic anchor. Hide it immediately, including anything
  // an already-running loader inserts before the document restart. React owns
  // the manual units and unmounts them through useAdRemovalActive instead.
  if (!document.getElementById(SUPPRESSION_STYLE)) {
    const style = document.createElement('style');
    style.id = SUPPRESSION_STYLE;
    style.textContent =
      '.adsbygoogle, .google-auto-placed, .web-ad-host { display: none !important; }';
    document.head.appendChild(style);
  }
  document
    .querySelectorAll('script[data-sg-adsense], script[data-sg-admax]')
    .forEach((script) => script.remove());
}

function onEntitlementChange(): void {
  if (!isAdRemovalActive()) {
    document.getElementById(SUPPRESSION_STYLE)?.remove();
    return;
  }
  hideWebAds();
  if (!networkStarted || reloadRequested || !isManagedOwnerAdRemovalActive()) return;
  reloadRequested = true;
  // Removing a script element does not stop JavaScript that already ran.
  // Restart once after an explicit owner action has saved the entitlement.
  // The local queued read also lets a pending Reset/key replacement win.
  void isManagedOwnerAdRemovalPersisted()
    .then((persisted) => {
      if (!persisted || !isManagedOwnerAdRemovalActive()) {
        reloadRequested = false;
        return;
      }
      markManagedOwnerReturn();
      reload();
    })
    .catch(() => {
      // A browser/storage failure must never escape into the owner action.
      reloadRequested = false;
    });
}

export function watchWebAdRemoval(): void {
  unsubscribe ??= subscribeAdRemoval(onEntitlementChange);
  if (isAdRemovalActive()) onEntitlementChange();
}

/** Called only at a real network loader insertion, never for placeholders. */
export function noteWebAdRequest(): void {
  networkStarted = true;
  watchWebAdRemoval();
}

/** Test seam: navigation itself is the browser's job. */
export function resetWebAdLifecycleForTesting(nextReload?: () => void): void {
  unsubscribe?.();
  unsubscribe = null;
  networkStarted = false;
  reloadRequested = false;
  reload = nextReload ?? (() => window.location.reload());
  document.getElementById(SUPPRESSION_STYLE)?.remove();
}
