import type { Seat } from '../gameTypes';

/** Small wire guards shared only by the three hidden-information adapters. */
export const record = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
export const keys = (x: Record<string, unknown>, fields: string): boolean => {
  const names = fields.split(' ');
  return Object.keys(x).length === names.length && names.every((key) => Object.hasOwn(x, key));
};
export const integer = (x: unknown, max: number, min = 0): x is number =>
  typeof x === 'number' && Number.isSafeInteger(x) && x >= min && x <= max;
export const seat = (x: unknown): x is Seat => x === 0 || x === 1;
export const pair = <T>(x: unknown, guard: (x: unknown) => x is T): x is [T, T] =>
  Array.isArray(x) && x.length === 2 && x.every(guard);
export const cards = (x: unknown, max: number, count: number): x is number[] =>
  Array.isArray(x) &&
  x.length <= count &&
  x.every((v) => integer(v, max)) &&
  new Set(x).size === x.length;
export const scores = (x: unknown): x is [number, number] =>
  pair(x, (n): n is number => integer(n, 1_000_000));
/** Detaches every nested public array from the host's private state. */
export const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
