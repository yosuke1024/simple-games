/**
 * The bundled catalogue of docs/UNBLOCK_PUZZLE_RULES.md §8, checked — not
 * sampled. A bundled board is dealt as it is (every Hard board, every daily,
 * an Easy or Medium fallback) and is the board every Easy and Medium deal
 * starts from, so each one must be exactly what the data says.
 *
 * This file checks the data's shape — sorted, well-formed, no board or
 * component twice, the daily's walk through the Medium list — and every Easy
 * and Medium entry in full (catalogueVerify.ts `checkEntry`: a legal board in
 * canonical order, the recorded fewest moves by a complete search of its
 * component, the tier on both measures, and the independent brute-force
 * oracle's agreement). The Hard entries, most of the list, are checked the
 * same way by catalogue.hard-1.test.ts … catalogue.hard-6.test.ts, a sixth
 * each, so the work spreads across workers. Provenance — that these are the
 * generator's own boards — is catalogueBuild.test.ts.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BIT_ALPHABET,
  RUN,
  bucketCode,
  catalogueEntry,
  catalogueSize,
  type CatalogueEntry,
} from './catalogue';
import { CATALOGUE_DATA } from './catalogueData';
import { checkSlice, holdsBoard } from './catalogueVerify';
import { COMPONENT_LIMIT, DAILY_STRIDE, TIERS, componentKey } from './generator';
import { exploreComponent } from './search';
import { encodeBoard } from './serialize';
import { DIFFICULTIES } from './types';

/**
 * The build-output guard greps every built file, this game's chunk and so the
 * bundled text included, for ad, analytics and site-chrome markers; a match
 * fails CI on both builds. Its patterns are read from the script itself, so
 * this check moves with the guard (catalogue.ts `BIT_ALPHABET`).
 */
const GUARD = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../../.github/scripts/check-dist-ads-separation.sh',
);
const GUARD_PATTERNS = [
  'ads_pattern',
  'analytics_pattern',
  'measurement_id_pattern',
  'chrome_pattern',
] as const;

const all = (difficulty: (typeof DIFFICULTIES)[number]): CatalogueEntry[] =>
  Array.from({ length: catalogueSize(difficulty) }, (_, index) =>
    catalogueEntry(difficulty, index),
  );

describe('the bundled catalogue (§8)', () => {
  it('holds a list for every tier, long enough to rarely repeat', () => {
    expect(catalogueSize('easy')).toBeGreaterThanOrEqual(1_000);
    expect(catalogueSize('medium')).toBeGreaterThanOrEqual(2_000);
    expect(catalogueSize('hard')).toBeGreaterThanOrEqual(8_000);
  });

  it('groups each tier by fewest moves inside the band, each group sorted and well-formed', () => {
    for (const difficulty of DIFFICULTIES) {
      const spec = TIERS[difficulty];
      let previous = -1;
      for (const bucket of CATALOGUE_DATA[difficulty]) {
        expect(bucket.minMoves).toBeGreaterThan(previous);
        previous = bucket.minMoves;
        expect(bucket.minMoves).toBeGreaterThanOrEqual(spec.minMoves);
        expect(bucket.minMoves).toBeLessThanOrEqual(spec.maxMoves);
        expect(bucket.count).toBeGreaterThan(0);
        const runs = Math.ceil(bucket.count / RUN);
        expect(bucket.firsts).toHaveLength(runs);
        expect(bucket.offsets).toHaveLength(runs);
        expect(bucket.ks).toHaveLength(runs);
        let code = -1;
        for (let index = 0; index < bucket.count; index++) {
          const next = bucketCode(bucket, index);
          expect(next, `${difficulty} ${bucket.minMoves} ${index}`).toBeGreaterThan(code);
          expect(Number.isSafeInteger(next)).toBe(true);
          code = next;
        }
      }
    }
  });

  it.each(DIFFICULTIES)(
    'never bundles a %s board twice, nor two boards of one component',
    (difficulty) => {
      {
        const entries = all(difficulty);
        expect(new Set(entries.map((entry) => encodeBoard(entry.board))).size).toBe(entries.length);
        // Two boards share a component only if they have the same blocks in
        // the same lanes; within each such group, list each board's component
        // and look for the others in it.
        const byBlocks = new Map<string, CatalogueEntry[]>();
        for (const entry of entries) {
          const key = componentKey(entry.board);
          byBlocks.set(key, [...(byBlocks.get(key) ?? []), entry]);
        }
        for (const group of byBlocks.values()) {
          if (group.length < 2) continue;
          for (const entry of group) {
            const listed = exploreComponent(entry.board, COMPONENT_LIMIT);
            expect(listed.status).toBe('complete');
            if (listed.status !== 'complete') continue;
            for (const other of group) {
              if (other === entry) continue;
              expect(holdsBoard(listed.component, other.board), difficulty).toBe(false);
            }
          }
        }
      }
    },
  );

  it('lets the daily step through the whole Medium list before it repeats a board', () => {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    expect(gcd(DAILY_STRIDE, catalogueSize('medium'))).toBe(1);
  });

  it('spells nothing the build-output guard reads as ad, analytics or site-chrome code', () => {
    expect(BIT_ALPHABET).toHaveLength(64);
    expect(new Set(BIT_ALPHABET).size).toBe(64);
    expect(BIT_ALPHABET).not.toContain('-');
    const script = readFileSync(GUARD, 'utf8');
    const patterns = GUARD_PATTERNS.map((name) => {
      const source = new RegExp(`^${name}='([^']+)'$`, 'm').exec(script)?.[1];
      expect(source, `${name} in check-dist-ads-separation.sh`).toBeDefined();
      return [name, new RegExp(source ?? '(?!)')] as const;
    });
    let buckets = 0;
    for (const difficulty of DIFFICULTIES) {
      for (const bucket of CATALOGUE_DATA[difficulty]) {
        buckets++;
        for (const [name, pattern] of patterns) {
          expect(
            pattern.exec(bucket.bits)?.[0],
            `${difficulty} ${bucket.minMoves} ${name}`,
          ).toBeUndefined();
        }
      }
    }
    expect(buckets).toBeGreaterThan(0);
  });
});

checkSlice('easy', 1, 1);
checkSlice('medium', 1, 1);
