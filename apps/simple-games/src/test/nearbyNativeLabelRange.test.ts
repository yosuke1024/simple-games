/**
 * The native discovery layers accept exactly the game codes the app uses.
 *
 * A Nearby label is `P-` + (game code | 0x80) + 4 hex digits
 * (src/nearby/discovery.ts `metadataGameCode`). Android
 * `DiscoveryLabel.metadataCapable` and iOS `NearbyPlayListing.supportsProbe`
 * keep a fixed range of those bytes, not "any high bit": the first Nearby
 * build drew all six digits at random, and an old Android host treats a GATT
 * connection itself as admission, so native never probes an unknown byte.
 *
 * That range is a third copy of src/app/nearbyGameIds.ts, in two other
 * languages, and nothing tied them together. On 2026-11-04/05 fourteen games
 * (Hearts 0x0F … Indian Rummy 0x1C) were added to the table but not to the
 * range: both platforms refused `start()` with a listing, so every one of
 * them showed "Could not connect" on real devices while Ludo (0x0E, the old
 * upper bound) worked. Unit tests could not see it — they run against a mock
 * plugin. This gate reads the two native sources and fails when the table
 * and the ranges disagree.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NEARBY_GAME_CODES } from '../app/nearbyGameIds';

const APP = resolve(__dirname, '../..');
const ANDROID = resolve(
  APP,
  'android/app/src/main/java/com/pixapps/simplegames/nearby/DiscoveryLabel.java',
);
const IOS = resolve(APP, 'ios/App/App/NearbyPlayRuntimeState.swift');

const codes = Object.values(NEARBY_GAME_CODES).map((code) => parseInt(code, 16));
const highest = Math.max(...codes);

function androidRange(): [number, number] {
  const source = readFileSync(ANDROID, 'utf8');
  const match = /return code >= (0x[0-9a-fA-F]{2}) && code <= (0x[0-9a-fA-F]{2});/.exec(source);
  expect(match, 'DiscoveryLabel.metadataCapable keeps its range as one return').not.toBeNull();
  return [parseInt(match![1] ?? '', 16), parseInt(match![2] ?? '', 16)];
}

function iosRange(): [number, number] {
  const source = readFileSync(IOS, 'utf8');
  const match = /return \((0x[0-9a-fA-F]{2})\.\.\.(0x[0-9a-fA-F]{2})\)\.contains\(code\)/.exec(
    source,
  );
  expect(match, 'NearbyPlayListing.supportsProbe keeps its range as one return').not.toBeNull();
  return [parseInt(match![1] ?? '', 16), parseInt(match![2] ?? '', 16)];
}

describe('the native label range', () => {
  it('starts from code 0x01 and has no gaps, so a range can describe it', () => {
    expect([...codes].sort((a, b) => a - b)).toEqual(
      Array.from({ length: codes.length }, (_, index) => index + 1),
    );
    expect(highest).toBeLessThan(0x80);
  });

  it('on Android covers every Nearby game and nothing past the last one', () => {
    expect(androidRange()).toEqual([0x81, 0x80 | highest]);
  });

  it('on iOS covers every Nearby game and nothing past the last one', () => {
    expect(iosRange()).toEqual([0x81, 0x80 | highest]);
  });
});
