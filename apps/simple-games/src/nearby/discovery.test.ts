import { describe, expect, it } from 'vitest';
import { NEARBY_GAME_CODES } from '../app/nearbyGameIds';
import {
  gameForLabel,
  isMetadataLabel,
  metadataGameCode,
  parseListing,
  serializeListing,
} from './discovery';
import type { NearbyGameId } from './gameTypes';
import { PROTOCOL_VERSION } from './session';

const label = 'P-81ABCD';
const valid = {
  v: 2,
  label,
  roomName: 'Pixel',
  gameId: 'yacht',
  protocol: PROTOCOL_VERSION,
  available: true,
};

describe('nearby discovery metadata', () => {
  it('round trips every supported game and the maximum Unicode room title within a DNS-SD TXT item', () => {
    for (const gameId of Object.keys(NEARBY_GAME_CODES) as NearbyGameId[]) {
      const candidateLabel = `F-${metadataGameCode(gameId)}1234`;
      for (const roomName of ['Pixel', '🎲'.repeat(24), '"\\'.repeat(12), '日本語の募集名']) {
        const raw = serializeListing(candidateLabel, roomName, gameId)!;
        expect(new TextEncoder().encode(`listing=${raw}`).length).toBeLessThanOrEqual(255);
        expect(parseListing(raw, candidateLabel)).toEqual({
          ...valid,
          label: candidateLabel,
          roomName,
          gameId,
        });
        expect(gameForLabel(candidateLabel)).toBe(gameId);
        expect(isMetadataLabel(candidateLabel)).toBe(true);
        expect(gameForLabel(`F-${NEARBY_GAME_CODES[gameId]}1234`)).toBe(gameId);
        expect(isMetadataLabel(`F-${NEARBY_GAME_CODES[gameId]}1234`)).toBe(false);
      }
    }
  });

  it.each([
    { v: 1 },
    { available: false },
    { available: 1 },
    { protocol: PROTOCOL_VERSION - 1 },
    { gameId: 'unknown' },
    { gameId: 'chess' },
    { label: 'P-811234' },
    { roomName: '' },
    { roomName: ' Pixel' },
    { roomName: 'x'.repeat(25) },
    { roomName: 'a\nb' },
    { roomName: '\ud800' },
    { roomName: 'x\u202ey' },
    { extra: 'ignored' },
    { name: 'Personal name must not be advertised' },
  ])('rejects an incompatible or unsafe listing: %j', (change) => {
    expect(parseListing(JSON.stringify({ ...valid, ...change }), label)).toBeNull();
  });

  it('bounds UTF-8 bytes, requires all fields, and rejects malformed/native non-string data', () => {
    const raw = JSON.stringify(valid);
    const sized = raw.padEnd(255, ' ');
    expect(parseListing(sized, label)).toEqual(valid);
    expect(parseListing(`${sized} `, label)).toBeNull();
    const unicodePadded = JSON.stringify({ ...valid, roomName: '🎲'.repeat(24) }).padEnd(255, ' ');
    expect(unicodePadded.length).toBe(255);
    expect(new TextEncoder().encode(unicodePadded).length).toBeGreaterThan(255);
    expect(parseListing(unicodePadded, label)).toBeNull();
    expect(parseListing(`${raw}${' '.repeat(256)}`, label)).toBeNull();
    expect(parseListing(JSON.stringify({ ...valid, roomName: '🎲'.repeat(64) }), label)).toBeNull();
    for (const bad of [null, undefined, {}, [], 'null', '[1]', '{', '{}'])
      expect(parseListing(bad, label)).toBeNull();
    for (const key of Object.keys(valid)) {
      const copy = { ...valid } as Record<string, unknown>;
      delete copy[key];
      expect(parseListing(JSON.stringify(copy), label)).toBeNull();
    }
    expect(serializeListing(label, '\u0000', 'yacht')).toBeNull();
    expect(gameForLabel('F-FF1234')).toBeNull();
    expect(gameForLabel('F-01abcd')).toBeNull();
    expect(parseListing(JSON.stringify({ ...valid, label: 'P-01ABCD' }), 'P-01ABCD')).toBeNull();
  });
});
