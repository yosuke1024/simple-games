/**
 * How often the result screens show a display ad (docs/ADS_POLICY.md
 * 「Web 版」): every RESULT_AD_EVERY-th finished game of the session, and
 * never on the session's first result — an ad on every result screen is
 * exactly the noise this collection promises not to make. The count is
 * in-memory on purpose: a session is one page visit, nothing is persisted,
 * and a fresh visit starts quiet again.
 *
 * Safe for any bundle (counting only, no ad-network identifiers) — the same
 * status as config.ts.
 */

const RESULT_AD_EVERY = 3;

let resultViews = 0;

/**
 * Records that a result screen is being shown and answers whether THIS one
 * carries the ad. Call exactly once per result view (ResultAdSlot does).
 */
export function recordResultView(): boolean {
  resultViews += 1;
  return resultViews % RESULT_AD_EVERY === 0;
}

/** Test hook. */
export function resetResultCadenceForTesting(): void {
  resultViews = 0;
}
