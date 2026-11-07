import { afterEach, describe, expect, it, vi } from 'vitest';
import { hostRandom } from './groupCards';

afterEach(() => vi.unstubAllGlobals());

function words(values: number[]) {
  const getRandomValues = vi.fn((out: Uint32Array) => {
    const next = values.shift();
    if (next === undefined) throw new Error('Unexpected entropy request');
    out[0] = next;
    return out;
  });
  vi.stubGlobal('crypto', { getRandomValues });
  return getRandomValues;
}

describe('bounded host randomness', () => {
  it('rejects the partial bucket instead of favouring low card indices', () => {
    const draw = words([0xffffffff, 4294967248, 4294967247, 0]);
    expect(hostRandom(52)).toBe(51);
    expect(draw).toHaveBeenCalledTimes(3);
    expect(hostRandom(52)).toBe(0);
  });

  it('keeps each residue equally represented in accepted full buckets', () => {
    words(Array.from({ length: 520 }, (_, i) => i));
    const counts = Array<number>(52).fill(0);
    for (let i = 0; i < 520; i++) counts[hostRandom(52)]!++;
    expect(counts).toEqual(Array<number>(52).fill(10));
  });

  it('handles one choice and the full unsigned 32-bit range', () => {
    words([0xffffffff, 0xffffffff, 0]);
    expect(hostRandom(1)).toBe(0);
    expect(hostRandom(0x100000000)).toBe(0xffffffff);
    expect(hostRandom(0x100000000)).toBe(0);
  });

  it.each([0, -1, 1.5, NaN, Infinity, 0x100000001])('rejects invalid bound %s', (bound) => {
    const draw = words([]);
    expect(() => hostRandom(bound)).toThrow(RangeError);
    expect(draw).not.toHaveBeenCalled();
  });
});
