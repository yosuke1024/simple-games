/**
 * Every hint gets one plain sentence, and no sentence names a technique
 * (docs/BINARY_BALANCE_RULES.md §8).
 */
import { describe, expect, it } from 'vitest';
import type { Hint, Link, SolveStep, Technique } from '../game';
import { en } from '../i18n/en';
import { hintMessage } from './hintMessage';

const step = (technique: Technique, value: 0 | 1, link: number | null = null): Hint => ({
  kind: 'step',
  step: {
    index: 0,
    value,
    technique,
    line: { axis: 'row', index: 0 },
    support: [],
    link,
  } satisfies SolveStep,
});

const links: Link[] = [
  { index: 0, dir: 'h', same: true },
  { index: 0, dir: 'v', same: false },
];

describe('hint sentences (§8)', () => {
  it('has one for a broken rule and one for a mark that cannot be right', () => {
    expect(hintMessage({ kind: 'violation', cells: [0], links: [] }, links).key).toBe(
      'binaryBalanceHintViolation',
    );
    expect(hintMessage({ kind: 'wrong', index: 3 }, links).key).toBe('binaryBalanceHintWrong');
  });

  it('maps each technique to its own sentence, and a link to its kind', () => {
    expect(hintMessage(step('pair-gap', 0), links).key).toBe('binaryBalanceHintPairGap');
    expect(hintMessage(step('line-count', 0), links).key).toBe('binaryBalanceHintLineCount');
    expect(hintMessage(step('link', 0, 0), links).key).toBe('binaryBalanceHintLinkSame');
    expect(hintMessage(step('link', 0, 1), links).key).toBe('binaryBalanceHintLinkDiff');
    expect(hintMessage(step('line-completion', 0), links).key).toBe(
      'binaryBalanceHintLineCompletion',
    );
    expect(hintMessage(step('hypothesis', 0), links).key).toBe('binaryBalanceHintHypothesis');
  });

  it('names the mark proved and the one ruled out', () => {
    expect(hintMessage(step('pair-gap', 1), links)).toMatchObject({
      mark: 'binaryBalanceMarkMoon',
      other: 'binaryBalanceMarkSun',
    });
  });

  it('never puts a technique name on screen', () => {
    const sentences = Object.entries(en)
      .filter(([key]) => key.startsWith('binaryBalanceHint'))
      .map(([, text]) => text.toLowerCase());
    for (const name of [
      'pair-gap',
      'pair gap',
      'line-count',
      'line-completion',
      'hypothesis',
      'technique',
    ]) {
      for (const sentence of sentences) expect(sentence).not.toContain(name);
    }
  });
});
