/**
 * The mount point for the shared PixApps header inside one screen
 * (docs/WEB_VERSION.md「サイトクローム」).
 *
 * This module must never reach the native app: WebChromeSlot references it
 * behind an `import.meta.env.MODE === 'web'` gate, so the default
 * (native-mode) build contains none of it — verified against the built
 * bundles by .github/scripts/check-dist-ads-separation.sh in CI.
 *
 * It renders an empty box and asks host.ts to move the one live header into
 * it. Nothing is created or destroyed per mount: no listener, no timer, no
 * frame (docs/GAME_LIFECYCLE.md). If the header has not loaded yet — or
 * never loads, because the visit is offline — this stays an empty box with
 * no height, which is why an absent header leaves no gap.
 */
import { useEffect, useRef } from 'react';
import { claimChrome, releaseChrome } from './host';

export default function WebChrome() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    claimChrome(host);
    return () => releaseChrome(host);
  }, []);

  return <div className="sg-web-chrome" ref={hostRef} />;
}
