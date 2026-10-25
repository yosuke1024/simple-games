import { isNearbyGameId, NEARBY_GAME_CODES } from '../app/nearbyGameIds';
import type { NearbyGameId } from './gameTypes';
import { isPlayerName, PROTOCOL_VERSION } from './session';

export interface DiscoveryListing {
  v: 1;
  label: string;
  name: string;
  gameId: NearbyGameId;
  protocol: typeof PROTOCOL_VERSION;
  available: true;
}

export interface DiscoveredPeer {
  id: string;
  /** Public discovery label, not an authentication secret. */
  name: string;
  gameId: NearbyGameId;
  hostName?: string;
}

const encoder = new TextEncoder();
const keys = ['available', 'gameId', 'label', 'name', 'protocol', 'v'];

export function gameForLabel(label: string): NearbyGameId | null {
  if (!/^[PF]-[A-F0-9]{6}$/.test(label)) return null;
  const code = (parseInt(label.slice(2, 4), 16) & 0x7f).toString(16).toUpperCase().padStart(2, '0');
  return (
    (Object.keys(NEARBY_GAME_CODES) as NearbyGameId[]).find(
      (gameId) => NEARBY_GAME_CODES[gameId] === code,
    ) ?? null
  );
}

export function isMetadataLabel(label: string): boolean {
  return gameForLabel(label) !== null && (parseInt(label.slice(2, 4), 16) & 0x80) !== 0;
}

export function metadataGameCode(gameId: NearbyGameId): string {
  return (parseInt(NEARBY_GAME_CODES[gameId], 16) | 0x80).toString(16).toUpperCase();
}

/** An advertised name is untrusted until it matches the encrypted session hello. */
export function parseListing(raw: unknown, label: string): DiscoveryListing | null {
  if (typeof raw !== 'string' || raw.length > 255 || encoder.encode(raw).length > 255) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const v = value as Record<string, unknown>;
    if (
      Object.keys(v).sort().join(',') !== keys.join(',') ||
      v.v !== 1 ||
      v.label !== label ||
      !isMetadataLabel(label) ||
      !isPlayerName(v.name) ||
      !isNearbyGameId(v.gameId) ||
      gameForLabel(label) !== v.gameId ||
      v.protocol !== PROTOCOL_VERSION ||
      v.available !== true
    )
      return null;
    return v as unknown as DiscoveryListing;
  } catch {
    return null;
  }
}

export function serializeListing(label: string, name: string, gameId: NearbyGameId): string | null {
  const raw = JSON.stringify({
    v: 1,
    label,
    name,
    gameId,
    protocol: PROTOCOL_VERSION,
    available: true,
  });
  // A DNS-SD TXT item also contains the eight ASCII bytes of "listing=".
  return encoder.encode(raw).length <= 247 && parseListing(raw, label) ? raw : null;
}
