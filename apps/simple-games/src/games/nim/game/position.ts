/** Shared initial positions and xor arithmetic; no CPU/session dependency. */
export function random(seed: number): number {
  let x = seed >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return (x ^ (x >>> 15)) >>> 0;
}
export const nimSum = (heaps: readonly number[]): number => heaps.reduce((a, b) => a ^ b, 0);
export function initialHeaps(seed: number): number[] {
  const heaps = Array.from({ length: 4 }, (_, i) => 2 + (random(seed + i * 997) % 7));
  if (nimSum(heaps) === 0) heaps[3] = heaps[3]! - 1;
  return heaps;
}
