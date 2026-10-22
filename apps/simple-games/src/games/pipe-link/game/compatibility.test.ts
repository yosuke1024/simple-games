/**
 * Golden boards, v1: fixed seeds, exact strings (docs/PIPE_LINK_RULES.md §4).
 *
 * A seed is a promise. A daily is the same board for everyone who opens it,
 * and a seed pins a difficulty board down — so any change to the rng, the
 * growth, the source choice, the grading, the tier bands or the scramble
 * that moves a board fails here. Changing these strings is a decision, not a
 * side effect.
 *
 * **Fix the implementation, not the test** — unless the change is meant. A
 * saved game holds its board, answer and orientations verbatim (§7), so a
 * suspended game survives a generator change; what a change costs is that
 * the same seed (and the same daily date) gives another board. While Pipe
 * Link is in the browser's early release (docs/WEB_VERSION.md「先行公開」)
 * that is allowed, but say so in the commit message. The bundled boards are
 * pinned by bundled.test.ts in the same way.
 */
import { describe, expect, it } from 'vitest';
import { encodeOrientations, encodeTypes } from './serialize';
import { createDailySession, createDifficultySession, type PipeLinkSession } from './session';

const pin = (session: PipeLinkSession) => ({
  types: encodeTypes(session.board.types),
  source: session.board.source,
  solution: encodeOrientations(session.solution),
  initial: encodeOrientations(session.initial),
});

describe('golden boards (v1)', () => {
  it('the easy board for seed pipe-link-easy-golden is unchanged', () => {
    expect(pin(createDifficultySession('easy', 'pipe-link-easy-golden'))).toEqual({
      types: 'lstsleltleeteteltettellee',
      source: 7,
      solution: '1111201320121221220200300',
      initial: '2001021022122032122330123',
    });
  });

  it('the medium board for seed pipe-link-medium-golden is unchanged', () => {
    expect(pin(createDifficultySession('medium', 'pipe-link-medium-golden'))).toEqual({
      types: 'elelsslltltestetttestelsleetlstttlstseeseslsselee',
      source: 17,
      solution: '1221112120211200121121300312113112001300000113030',
      initial: '2011003022330203201032211331312021110201112100330',
    });
  });

  it('the hard board for seed pipe-link-hard-golden is unchanged', () => {
    expect(pin(createDifficultySession('hard', 'pipe-link-hard-golden'))).toEqual({
      types: 'esleleeeeetsttlssleetltlsllelttllttttteseeetteltlllltleeettelsse',
      source: 36,
      solution: '1121222221312030013120130022013201331330201122120213030013330113',
      initial: '0002223120001201032101110311111031230330212331332020101311121111',
    });
  });

  it('the daily board for 2026-10-22 is unchanged', () => {
    expect(pin(createDailySession('2026-10-22'))).toEqual({
      types: 'eeleelesetttsesettetltttttteellsteeltetltlelelele',
      source: 16,
      solution: '2122213012020202020030320133013003212120130030303',
      initial: '1313000123121313300023332331133130303031302101132',
    });
  });
});
