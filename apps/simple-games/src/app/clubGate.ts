/**
 * The one place Core reaches the Club House layer (docs/architecture/club.md
 * §3, PRODUCT_PRINCIPLES「機械で示すこと」4). `src/club/` is a chunk of its
 * own, imported dynamically from here and nowhere else
 * (src/test/importBoundaries.test.ts rule 5). It is loaded in exactly three
 * cases, each the player's own doing or its consequence:
 *
 *   1. boot, when `sg.club` already holds a connection — the home's entry and
 *      the result screens' action need the layer to draw themselves;
 *   2. an invite link was opened (club.md §7);
 *   3. the player pressed Settings › Advanced › Club House, or the home's
 *      `Play together`.
 *
 * Nothing else calls `loadClub`, so a device that never joined and never
 * tapped either entry never parses a byte of it. A load failure is swallowed
 * the way boot.ts swallows a failing step: the home and the games know
 * nothing about it.
 */
import type { KVStore } from '../storage/kv';
import { preferencesKV } from '../storage/kv';
import { loadRecord } from '../storage/repo';
import { clubConnectionsSchema } from '../storage/schemas';
import type { ClubConnectionSummary, ClubInvite, ClubModule } from '../ui/clubBridge';

let connections: readonly ClubConnectionSummary[] = [];

/** Boot step: read `sg.club` so `isConnected()` can answer without the layer. */
export async function initClubGate(kv: KVStore = preferencesKV): Promise<void> {
  const record = await loadRecord(clubConnectionsSchema, kv);
  connections = record.connections.map(summarize);
}

const summarize = (c: {
  endpoint: string;
  clubId: string;
  clubName: string;
  nickname: string;
  role: 'owner' | 'member';
}): ClubConnectionSummary => ({
  endpoint: c.endpoint,
  clubId: c.clubId,
  clubName: c.clubName,
  nickname: c.nickname,
  role: c.role,
});

/** The connections as last known — from boot, then as the Club layer reports changes. */
export const clubConnections = (): readonly ClubConnectionSummary[] => connections;
export const isConnected = (): boolean => connections.length > 0;
export function noteClubConnections(next: readonly ClubConnectionSummary[]): void {
  connections = next;
}

type Loader = () => Promise<ClubModule>;
const realLoader: Loader = () => import('../club').then((m) => m.clubModule);
let loader: Loader = realLoader;
let loaded: Promise<ClubModule | null> | null = null;

/** Loads the layer once; null when it could not be loaded. Never throws. */
function loadClub(): Promise<ClubModule | null> {
  // Through a resolved promise, so even a loader that throws synchronously
  // ends up as the same quiet null. A failure is remembered for the session:
  // the next door press does not try again (no retry loop, club.md §10);
  // reopening the app is the retry.
  loaded ??= Promise.resolve()
    .then(loader)
    .catch(() => null);
  return loaded;
}

/** Case 1: at boot, only when a connection exists. Otherwise nothing happens. */
export function loadClubAtBoot(): Promise<ClubModule | null> | null {
  return isConnected() ? loadClub() : null;
}

/** Case 2: an invite link. */
export function loadClubForInvite(): Promise<ClubModule | null> {
  return loadClub();
}

/** Case 3: the player pressed one of the two entries. */
export function loadClubForEntry(): Promise<ClubModule | null> {
  return loadClub();
}

/**
 * The invite in the address, if the page was opened from one (club.md §7-1):
 * a path ending in `/join` and `#invite=<token>`. The fragment is removed at
 * once — before anyone joins — so the token stays out of the address bar,
 * history and bookmarks. Only the shape is read here; the Club layer checks
 * the endpoint and the token when it joins.
 */
export function takeInviteFromLocation(
  loc: Pick<Location, 'href' | 'pathname' | 'hash'> = window.location,
  replaceState: (href: string) => void = (href) =>
    window.history.replaceState(history.state, '', href),
): ClubInvite | null {
  if (!/\/join$/.test(loc.pathname)) return null;
  const match = /(?:^#|&)invite=([A-Za-z0-9_-]+)(?:&|$)/.exec(loc.hash);
  if (match === null) return null;
  let endpoint: string;
  try {
    endpoint = new URL(loc.href).origin;
  } catch {
    return null;
  }
  replaceState(loc.href.replace(/#.*$/, ''));
  return { endpoint, token: match[1]! };
}

/** Test seam: swap the dynamic import and forget what was loaded. */
export function setClubLoaderForTesting(next: Loader | null): void {
  loader = next ?? realLoader;
  loaded = null;
  connections = [];
}
