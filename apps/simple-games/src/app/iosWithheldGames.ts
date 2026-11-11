/**
 * Titles the iOS app does not offer (docs/PRODUCT_PRINCIPLES.md
 * 「iOS で出さないタイトル」). App Store Review rejected 1.8.4 on 2026-11-10
 * under guideline 2.3.6: simulated-gambling apps are accepted only from
 * organisation accounts, and this app is published from an individual one.
 * Blackjack and Texas Hold'em are simulated gambling even with free points
 * (BLACKJACK_RULES / TEXAS_HOLDEM_RULES), so the iOS app leaves them out while
 * Android and the browser version keep them.
 *
 * The registry marks the same titles with `unavailableOn: 'ios'`; that field
 * is what app/gameChannel.ts and the landing's share sync read. This list is
 * the copy the Nearby layer reads, because src/nearby may not import the
 * registry (src/test/importBoundaries.test.ts); gameChannel.test.ts pins the
 * two to each other. Import-free apart from Capacitor.
 */
import { Capacitor } from '@capacitor/core';

export const IOS_WITHHELD_GAME_IDS: readonly string[] = ['texas-holdem', 'blackjack'];

/** True only in the iOS app — not in Safari, where the browser version keeps every title. */
export function isIosApp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

/** Whether this build keeps the title off every door, Nearby included. */
export function isWithheldHere(id: string): boolean {
  return IOS_WITHHELD_GAME_IDS.includes(id) && isIosApp();
}
