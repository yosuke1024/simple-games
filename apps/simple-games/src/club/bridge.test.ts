import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryKV, type KVStore } from '@/storage/kv';
import { CLUB_OUTBOX_MAX_ATTEMPTS, type ClubConnection } from '@/storage/schemas';
import type { GameId } from '@/app/registry';
import type { ClubResultPayload } from '@/ui/clubBridge';
import { createBridge, loadConnections } from './bridge';
import { acceptAutoSend, addClubConnection, removeClubConnection } from './storage/connections';
import { enqueueResult, pendingFor } from './storage/outbox';

const E = 'https://club.example.com';
const F = 'https://second.example.com';
/** A connection whose owner accepted the automatic-send disclosure (joined, or accepted on the Club screen). */
const connection = (endpoint: string, name: string): ClubConnection => ({
  endpoint,
  clubId: `c_${name}`,
  clubName: name,
  memberId: 'm_1',
  memberToken: `secret-${name}`,
  nickname: 'Ken',
  role: 'member',
  joinedAt: 'x',
  autoSend: true,
});
/** One from before automatic sending existed: it never saw the disclosure. */
const unconsented = (endpoint: string, name: string): ClubConnection => {
  const { autoSend: _accepted, ...legacy } = connection(endpoint, name);
  return legacy;
};
const FAMILY = connection(E, 'Family');
const WORK = connection(F, 'Work');

const challengeJson = {
  id: 'ch_1',
  gameId: 'sudoku',
  contractVersion: 1,
  params: { difficulty: 'hard' },
  seed: 'sudoku-club-1',
  boardDigest: 'sd1:1',
  title: null,
  createdBy: { id: 'm_1', nickname: 'Ken' },
  createdAt: 'x',
  resultCount: 1,
  mine: true,
};
const resultJson = {
  memberId: 'm_1',
  nickname: 'Ken',
  submittedAt: 'x',
  outcome: 'completed',
  facts: {},
};
const rankingJson = {
  gameId: 'sudoku',
  paramsKey: 'hard',
  improved: false,
  rank: 4,
  entry: null,
  entryCount: 9,
};
const ok = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'X-Club-Api': '1' } });
const err = (status: number, code: string) => ok(status, { error: { code, message: 'x' } });

/** An ordinary board's result: no daily, so it is a ranking entry. */
const payload: ClubResultPayload = {
  gameId: 'sudoku',
  outcome: 'completed',
  facts: { elapsedSeconds: 271, mistakes: 0, hints: 1, device: 'pixel' },
  seed: 'sudoku-club-1',
  params: { difficulty: 'hard' },
  boardDigest: 'sd1:1',
};
const dailyPayload: ClubResultPayload = { ...payload, daily: '2026-10-02' };
/** The server's shape for a ranking `clientId` (club.md §16-1). */
const CLIENT_ID = /^[A-Za-z0-9_-]{8,64}$/;
/** The same ranking board with a different time: another finished game. */
const taking = (elapsedSeconds: number): ClubResultPayload => ({
  ...payload,
  facts: { elapsedSeconds, mistakes: 0, hints: 0 },
});
/** The ranking items waiting for an endpoint, as stored. */
const queuedRankings = async (endpoint: string, kv: KVStore) =>
  (await pendingFor(endpoint, kv)).flatMap((i) => (i.kind === 'ranking' ? [i] : []));

/** The URL path after `/api/v1` of every request a fetch mock got. */
const paths = (f: ReturnType<typeof vi.fn>) =>
  f.mock.calls.map((c) => String(c[0]).replace(/^https:\/\/[^/]+\/api\/v1/, ''));
const hosts = (f: ReturnType<typeof vi.fn>) => f.mock.calls.map((c) => new URL(String(c[0])).host);
const bodyOf = (f: ReturnType<typeof vi.fn>, call = 0) =>
  JSON.parse((f.mock.calls[call]![1] as { body: string }).body);

async function setup(
  fetchImpl: ReturnType<typeof vi.fn>,
  connections: readonly ClubConnection[] = [FAMILY],
) {
  const kv: KVStore = createMemoryKV();
  for (const c of connections) await addClubConnection(c, kv);
  return { kv, bridge: createBridge(kv, fetchImpl as unknown as typeof fetch) };
}

describe('sendResult: routing', () => {
  it('a daily with a digest creates the day challenge with a null title', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(ok(201, challengeJson)));
    const { bridge } = await setup(f);
    const reports = await bridge.sendResult(dailyPayload);
    expect(reports).toEqual([{ endpoint: E, clubName: 'Family', outcome: 'sent' }]);
    expect(paths(f)).toEqual(['/challenges']);
    expect(bodyOf(f)).toMatchObject({
      gameId: 'sudoku',
      contractVersion: 1,
      params: { difficulty: 'hard' },
      seed: 'sudoku-club-1',
      boardDigest: 'sd1:1',
      title: null,
      daily: '2026-10-02',
      result: { outcome: 'completed', facts: { elapsedSeconds: 271, mistakes: 0, hints: 1 } },
    });
    // The device name the game offered is not in the contract's facts and does not travel.
    expect(JSON.stringify(bodyOf(f))).not.toContain('pixel');
    expect((f.mock.calls[0]![1] as { headers: Record<string, string> }).headers.Authorization).toBe(
      'Bearer secret-Family',
    );
  });

  it('anything else goes to the ranking with its paramsKey', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(ok(200, rankingJson)));
    const { bridge } = await setup(f);
    // `improved: false` is still a success.
    expect((await bridge.sendResult(payload))[0]?.outcome).toBe('sent');
    expect(paths(f)).toEqual(['/rankings/results']);
    expect(bodyOf(f)).toEqual({
      gameId: 'sudoku',
      contractVersion: 1,
      paramsKey: 'hard',
      params: { difficulty: 'hard' },
      seed: 'sudoku-club-1',
      boardDigest: 'sd1:1',
      outcome: 'completed',
      facts: { elapsedSeconds: 271, mistakes: 0, hints: 1 },
      clientId: expect.stringMatching(CLIENT_ID),
    });
  });

  it('a daily carries no clientId: the day’s challenge dedupes on the board', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(ok(201, challengeJson)));
    const { bridge, kv } = await setup(f);
    await bridge.sendResult(dailyPayload);
    expect(bodyOf(f)).not.toHaveProperty('clientId');
    f.mockRejectedValue(new TypeError('offline'));
    await bridge.sendResult({ ...dailyPayload, seed: 'sudoku-club-2' });
    const [queued] = await pendingFor(E, kv);
    expect(queued?.kind).toBe('daily');
    expect(queued).not.toHaveProperty('clientId');
  });

  it('a result with no digest goes to the ranking with boardDigest null', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(ok(200, rankingJson)));
    const { bridge } = await setup(f);
    await bridge.sendResult({ ...payload, boardDigest: null });
    expect(paths(f)).toEqual(['/rankings/results']);
    expect(bodyOf(f).boardDigest).toBeNull();
  });

  it('a daily without a digest is an ordinary ranking result', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(ok(200, rankingJson)));
    const { bridge } = await setup(f);
    await bridge.sendResult({ ...dailyPayload, boardDigest: null });
    expect(paths(f)).toEqual(['/rankings/results']);
    expect(bodyOf(f)).not.toHaveProperty('daily');
  });

  it('a played result (a loss, a dead end) is sent nowhere and queued nowhere', async () => {
    const f = vi.fn();
    const { bridge, kv } = await setup(f, [FAMILY, WORK]);
    expect(await bridge.sendResult({ ...payload, outcome: 'played' })).toEqual([]);
    expect(await bridge.sendResult({ ...dailyPayload, outcome: 'played' })).toEqual([]);
    expect(f).not.toHaveBeenCalled();
    expect(await pendingFor(E, kv)).toEqual([]);
    expect(await pendingFor(F, kv)).toEqual([]);
  });

  it('rejected for every Club, nothing sent: unknown game, bad facts, bad params', async () => {
    const f = vi.fn();
    const { bridge, kv } = await setup(f, [FAMILY, WORK]);
    for (const bad of [
      { ...payload, gameId: 'nope' as GameId },
      { ...payload, facts: { elapsedSeconds: 1 } },
      { ...payload, facts: { elapsedSeconds: 1e9, mistakes: 0, hints: 0 } },
      { ...payload, params: { difficulty: 'impossible' } },
    ]) {
      const reports = await bridge.sendResult(bad);
      expect(reports.map((r) => r.outcome)).toEqual(['rejected', 'rejected']);
    }
    expect(f).not.toHaveBeenCalled();
    expect(await pendingFor(E, kv)).toEqual([]);
  });

  it('sends nothing, and says nothing, with no Club joined', async () => {
    const f = vi.fn();
    const { bridge, kv } = await setup(f, []);
    expect(await bridge.sendResult(payload)).toEqual([]);
    expect(f).not.toHaveBeenCalled();
    expect(await pendingFor(E, kv)).toEqual([]);
  });
});

describe('sendResult: consent (club.md §4-1)', () => {
  it('a connection that never accepted the disclosure gets nothing: not sent, not queued, not reported', async () => {
    const f = vi.fn();
    const { bridge, kv } = await setup(f, [unconsented(E, 'Family')]);
    expect(await bridge.sendResult(payload)).toEqual([]);
    expect(await bridge.sendResult(dailyPayload)).toEqual([]);
    expect(f).not.toHaveBeenCalled();
    expect(await pendingFor(E, kv)).toEqual([]);
  });

  it('a result the contract rejects is not reported for an unconsented connection either', async () => {
    const f = vi.fn();
    const { bridge } = await setup(f, [unconsented(E, 'Family')]);
    expect(await bridge.sendResult({ ...payload, gameId: 'nope' as GameId })).toEqual([]);
    expect(await bridge.sendResult({ ...payload, facts: { elapsedSeconds: 1 } })).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it('with one Club consented and one not, only the consented one is sent to and reported', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(ok(200, rankingJson)));
    const { bridge, kv } = await setup(f, [FAMILY, unconsented(F, 'Work')]);
    const reports = await bridge.sendResult(payload);
    expect(reports).toEqual([{ endpoint: E, clubName: 'Family', outcome: 'sent' }]);
    expect(hosts(f)).toEqual(['club.example.com']);
    expect(await pendingFor(F, kv)).toEqual([]);

    // A rejected result still names only the consented one.
    const rejected = await bridge.sendResult({ ...payload, gameId: 'nope' as GameId });
    expect(rejected).toEqual([{ endpoint: E, clubName: 'Family', outcome: 'rejected' }]);
  });

  it('a played result (a loss) says nothing for an unconsented connection, as for any other', async () => {
    const f = vi.fn();
    const { bridge } = await setup(f, [unconsented(E, 'Family')]);
    expect(await bridge.sendResult({ ...payload, outcome: 'played' })).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it('accepting later starts the sending, from the next result: what was finished before is never offered', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(ok(200, rankingJson)));
    const { bridge, kv } = await setup(f, [unconsented(E, 'Family')]);
    expect(await bridge.sendResult(payload)).toEqual([]);
    expect(f).not.toHaveBeenCalled();

    await acceptAutoSend(E, kv);
    expect(await pendingFor(E, kv)).toEqual([]);
    // The same board played again is a new result now, and goes out once.
    expect((await bridge.sendResult(payload))[0]?.outcome).toBe('sent');
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('reads the consent when it is called, not when the screen opened: leaving and rejoining consented sends again', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(ok(200, rankingJson)));
    const { bridge, kv } = await setup(f, [FAMILY]);
    await bridge.sendResult(payload);
    expect(f).toHaveBeenCalledTimes(1);
    await removeClubConnection(E, kv);
    await addClubConnection(unconsented(E, 'Family'), kv);
    expect(
      await bridge.sendResult({ ...payload, facts: { ...payload.facts, mistakes: 2 } }),
    ).toEqual([]);
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe('sendResult: every Club', () => {
  it('sends to every connection, each with its own token, and reports in connection order', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(ok(200, rankingJson)));
    const { bridge } = await setup(f, [FAMILY, WORK]);
    const reports = await bridge.sendResult(payload);
    expect(reports).toEqual([
      { endpoint: E, clubName: 'Family', outcome: 'sent' },
      { endpoint: F, clubName: 'Work', outcome: 'sent' },
    ]);
    expect(new Set(hosts(f))).toEqual(new Set(['club.example.com', 'second.example.com']));
    const auth = f.mock.calls.map((c, i) => [
      new URL(String(c[0])).host,
      (f.mock.calls[i]![1] as { headers: Record<string, string> }).headers.Authorization,
    ]);
    expect(auth).toContainEqual(['club.example.com', 'Bearer secret-Family']);
    expect(auth).toContainEqual(['second.example.com', 'Bearer secret-Work']);
  });

  it('reads the connections when it is called: a Club joined later is included, one left is not', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(ok(200, rankingJson)));
    const { bridge, kv } = await setup(f, [FAMILY]);
    await bridge.sendResult({ ...payload, facts: { ...payload.facts, elapsedSeconds: 100 } });
    expect(hosts(f)).toEqual(['club.example.com']);

    await addClubConnection(WORK, kv);
    f.mockClear();
    await bridge.sendResult({ ...payload, facts: { ...payload.facts, elapsedSeconds: 90 } });
    expect(new Set(hosts(f))).toEqual(new Set(['club.example.com', 'second.example.com']));

    await removeClubConnection(E, kv);
    f.mockClear();
    await bridge.sendResult({ ...payload, facts: { ...payload.facts, elapsedSeconds: 80 } });
    expect(hosts(f)).toEqual(['second.example.com']);
  });

  it('one Club down does not stop the other', async () => {
    const f = vi
      .fn()
      .mockImplementation((url: string) =>
        new URL(url).origin === E
          ? Promise.reject(new TypeError('offline'))
          : Promise.resolve(ok(200, rankingJson)),
      );
    const { bridge, kv } = await setup(f, [FAMILY, WORK]);
    const reports = await bridge.sendResult(payload);
    expect(reports.map((r) => r.outcome)).toEqual(['queued', 'sent']);
    expect(await pendingFor(E, kv)).toHaveLength(1);
    expect(await pendingFor(F, kv)).toEqual([]);
  });

  it('LOST UPDATE: parallel failures to several Clubs leave one queued item each', async () => {
    const clubs = Array.from({ length: 6 }, (_, i) =>
      connection(`https://c${i}.example.com`, `C${i}`),
    );
    const f = vi.fn().mockRejectedValue(new TypeError('offline'));
    const { bridge, kv } = await setup(f, clubs);
    const reports = await bridge.sendResult(dailyPayload);
    expect(reports.map((r) => r.outcome)).toEqual(clubs.map(() => 'queued'));
    for (const c of clubs) {
      const pending = await pendingFor(c.endpoint, kv);
      expect(pending).toHaveLength(1);
      expect(pending[0]?.kind).toBe('daily');
    }
  });

  it('LOST UPDATE: parallel results of different games, offline, are all kept', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('offline'));
    const { bridge, kv } = await setup(f, [FAMILY, WORK]);
    const tables = [
      { ...payload, facts: { elapsedSeconds: 10, mistakes: 0, hints: 0 } },
      {
        ...payload,
        params: { difficulty: 'easy' },
        facts: { elapsedSeconds: 20, mistakes: 0, hints: 0 },
      },
      {
        ...payload,
        params: { difficulty: 'medium' },
        facts: { elapsedSeconds: 30, mistakes: 0, hints: 0 },
      },
    ];
    await Promise.all(tables.map((t) => bridge.sendResult(t)));
    expect(await pendingFor(E, kv)).toHaveLength(3);
    expect(await pendingFor(F, kv)).toHaveLength(3);
  });
});

describe('sendResult: what becomes of it', () => {
  it.each([
    ['no response', () => Promise.reject(new TypeError('offline'))],
    ['429 rate_limited', () => Promise.resolve(err(429, 'rate_limited'))],
    ['500 internal_error', () => Promise.resolve(err(500, 'internal_error'))],
    ['a 200 whose body is not an answer', () => Promise.resolve(ok(200, { nope: true }))],
    [
      'a platform error page without X-Club-Api (e.g. a used-up free quota)',
      () => Promise.resolve(new Response('quota', { status: 429 })),
    ],
  ])('queued on %s: the result waits for the next chance', async (_what, answer) => {
    const f = vi.fn().mockImplementation(answer);
    const { bridge, kv } = await setup(f);
    expect((await bridge.sendResult(dailyPayload))[0]?.outcome).toBe('queued');
    const pending = await pendingFor(E, kv);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.kind === 'daily' && pending[0].body.result.facts).toEqual({
      elapsedSeconds: 271,
      mistakes: 0,
      hints: 1,
    });
  });

  it.each([
    [409, 'board_mismatch'],
    [404, 'not_found'],
    [401, 'unauthorized'],
    [400, 'invalid_request'],
    [403, 'forbidden'],
    [413, 'too_large'],
    [400, 'unsupported_version'],
  ])('rejected on %i %s: final, so not kept', async (status, code) => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(err(status, code)));
    const { bridge, kv } = await setup(f);
    expect((await bridge.sendResult(dailyPayload))[0]?.outcome).toBe('rejected');
    expect(await pendingFor(E, kv)).toEqual([]);
  });

  it('rejected, not kept, by a server whose X-Club-Api this client does not know', async () => {
    const f = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(rankingJson), {
          status: 200,
          headers: { 'X-Club-Api': '2' },
        }),
      ),
    );
    const { bridge, kv } = await setup(f);
    expect((await bridge.sendResult(payload))[0]?.outcome).toBe('rejected');
    expect(await pendingFor(E, kv)).toEqual([]);
  });

  it('409 already_submitted on a daily is already: not an error, and nothing kept', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(err(409, 'already_submitted')));
    const { bridge, kv } = await setup(f);
    expect((await bridge.sendResult(dailyPayload))[0]?.outcome).toBe('already');
    expect(await pendingFor(E, kv)).toEqual([]);
  });

  it('gives up on a result a server keeps failing on, after the cap, without blocking later ones', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(err(500, 'internal_error')));
    const { bridge, kv } = await setup(f);
    for (let i = 1; i < CLUB_OUTBOX_MAX_ATTEMPTS; i++) {
      expect((await bridge.sendResult(dailyPayload))[0]?.outcome).toBe('queued');
    }
    // The cap's worth of failures drops the daily; the next result goes through.
    f.mockImplementation(() => Promise.resolve(ok(200, rankingJson)));
    const reports = await bridge.sendResult({
      ...payload,
      facts: { ...payload.facts, mistakes: 1 },
    });
    expect(reports[0]?.outcome).toBe('sent');
    expect(await pendingFor(E, kv)).toEqual([]);
  });
});

describe('sendResult: the outbox', () => {
  it('writes before it sends: the result is already in the outbox when the request goes out', async () => {
    let queuedDuringRequest = -1;
    const kv: KVStore = createMemoryKV();
    await addClubConnection(FAMILY, kv);
    const f = vi.fn().mockImplementation(async () => {
      queuedDuringRequest = (await pendingFor(E, kv)).length;
      return ok(200, rankingJson);
    });
    await createBridge(kv, f as unknown as typeof fetch).sendResult(payload);
    expect(queuedDuringRequest).toBe(1);
    expect(await pendingFor(E, kv)).toEqual([]);
  });

  it('flushes what waited, oldest first, before this result', async () => {
    const f = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(url.includes('/rankings/') ? ok(200, rankingJson) : ok(201, resultJson)),
      );
    const { bridge, kv } = await setup(f);
    await enqueueResult(
      {
        endpoint: E,
        challengeId: 'ch_old',
        result: {
          contractVersion: 1,
          boardDigest: 'sd1:9',
          outcome: 'completed',
          facts: { elapsedSeconds: 1, mistakes: 0, hints: 0 },
        },
        createdAt: 'x',
      },
      kv,
    );
    expect((await bridge.sendResult(payload))[0]?.outcome).toBe('sent');
    expect(paths(f)).toEqual(['/challenges/ch_old/results', '/rankings/results']);
    expect(await pendingFor(E, kv)).toEqual([]);
  });

  it('when an earlier result fails again, this one waits behind it with no second timeout', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('offline'));
    const { bridge, kv } = await setup(f);
    await bridge.sendResult(dailyPayload);
    expect(f).toHaveBeenCalledTimes(1);
    const reports = await bridge.sendResult({
      ...payload,
      params: { difficulty: 'easy' },
      facts: { elapsedSeconds: 5, mistakes: 0, hints: 0 },
    });
    // The head failed again and the flush stopped there; the new one never went out.
    expect(f).toHaveBeenCalledTimes(2);
    expect(reports[0]?.outcome).toBe('queued');
    expect(await pendingFor(E, kv)).toHaveLength(2);
  });

  it('every result for one table is queued as its own item, a worse one after a better one included', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('offline'));
    const { bridge, kv } = await setup(f);
    await bridge.sendResult(taking(300));
    await bridge.sendResult(taking(200));
    await bridge.sendResult(taking(400));
    const queued = await queuedRankings(E, kv);
    expect(queued.map((i) => i.body.facts.elapsedSeconds)).toEqual([300, 200, 400]);
    // Each has its own token, the same on the item and in its body.
    const ids = queued.map((i) => i.clientId);
    expect(new Set(ids).size).toBe(3);
    for (const i of queued) {
      expect(i.clientId).toMatch(CLIENT_ID);
      expect(i.body.clientId).toBe(i.clientId);
    }
  });

  it('a queued result is sent by the next one: all of them, oldest first, each under its own clientId', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('offline'));
    const { bridge, kv } = await setup(f);
    await bridge.sendResult(taking(300));
    await bridge.sendResult(taking(200));
    const waiting = (await queuedRankings(E, kv)).map((i) => i.clientId);

    f.mockReset().mockImplementation(() => Promise.resolve(ok(200, rankingJson)));
    const reports = await bridge.sendResult({
      ...payload,
      params: { difficulty: 'easy' },
      facts: { elapsedSeconds: 9, mistakes: 0, hints: 0 },
    });
    expect(reports[0]?.outcome).toBe('sent');
    expect(f).toHaveBeenCalledTimes(3);
    expect([0, 1, 2].map((n) => bodyOf(f, n).facts.elapsedSeconds)).toEqual([300, 200, 9]);
    expect([0, 1].map((n) => bodyOf(f, n).clientId)).toEqual(waiting);
    expect(await pendingFor(E, kv)).toEqual([]);
  });

  it('a result worse than the one already queued for its table is queued behind it, not dropped', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('offline'));
    const { bridge, kv } = await setup(f);
    await bridge.sendResult(taking(100));
    f.mockClear();
    const reports = await bridge.sendResult(taking(900));
    expect(reports[0]?.outcome).toBe('queued');
    // The head is retried once and fails again; the flush stops there, so the
    // worse result adds no second request (and no second timeout).
    expect(f).toHaveBeenCalledTimes(1);
    expect(bodyOf(f).facts.elapsedSeconds).toBe(100);
    expect((await queuedRankings(E, kv)).map((i) => i.body.facts.elapsedSeconds)).toEqual([
      100, 900,
    ]);
  });

  it('a result carries a different clientId for each Club, and for each result', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(ok(200, rankingJson)));
    const { bridge } = await setup(f, [FAMILY, WORK]);
    await bridge.sendResult(taking(100));
    await bridge.sendResult(taking(90));
    const ids = f.mock.calls.map((_c, n) => bodyOf(f, n).clientId);
    expect(ids).toHaveLength(4);
    for (const id of ids) expect(id).toMatch(CLIENT_ID);
    expect(new Set(ids).size).toBe(4);
  });
});

describe('sendResult: clientId', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is 128 random bits from getRandomValues, as hex', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(ok(200, rankingJson)));
    const { bridge } = await setup(f);
    const getRandomValues = vi.fn(<T extends ArrayBufferView | null>(array: T): T => {
      new Uint8Array((array as Uint8Array).buffer).fill(0xab);
      return array;
    });
    vi.stubGlobal('crypto', { getRandomValues });
    await bridge.sendResult(payload);
    expect(getRandomValues).toHaveBeenCalledTimes(1);
    expect(bodyOf(f).clientId).toBe('ab'.repeat(16));
  });

  it('falls back to Math.random where there is no crypto, and is still a valid token', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(ok(200, rankingJson)));
    const { bridge } = await setup(f);
    vi.stubGlobal('crypto', undefined);
    await bridge.sendResult(taking(100));
    await bridge.sendResult(taking(90));
    expect(bodyOf(f, 0).clientId).toMatch(CLIENT_ID);
    expect(bodyOf(f, 1).clientId).toMatch(CLIENT_ID);
    expect(bodyOf(f, 0).clientId).not.toBe(bodyOf(f, 1).clientId);
  });

  it('falls back too when getRandomValues throws', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(ok(200, rankingJson)));
    const { bridge } = await setup(f);
    vi.stubGlobal('crypto', {
      getRandomValues: () => {
        throw new Error('no entropy');
      },
    });
    await bridge.sendResult(payload);
    expect(bodyOf(f).clientId).toMatch(CLIENT_ID);
  });

  it('does not use randomUUID, which a Chromium 88 WebView on a plain page lacks', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(ok(200, rankingJson)));
    const { bridge } = await setup(f);
    const randomUUID = vi.fn(() => 'never-used-uuid');
    vi.stubGlobal('crypto', { randomUUID, getRandomValues: crypto.getRandomValues.bind(crypto) });
    await bridge.sendResult(payload);
    expect(randomUUID).not.toHaveBeenCalled();
  });
});

describe('sendResult: the same result twice', () => {
  it('a result screen that mounts again in one session does not send again', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(ok(200, rankingJson)));
    const { bridge } = await setup(f);
    const first = await bridge.sendResult(payload);
    const second = await bridge.sendResult({ ...payload, facts: { ...payload.facts } });
    expect(first[0]?.outcome).toBe('sent');
    expect(second[0]?.outcome).toBe('sent');
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('a Club joined between the two still gets its copy', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(ok(200, rankingJson)));
    const { bridge, kv } = await setup(f);
    await bridge.sendResult(payload);
    await addClubConnection(WORK, kv);
    const reports = await bridge.sendResult(payload);
    expect(reports.map((r) => r.outcome)).toEqual(['sent', 'sent']);
    expect(hosts(f)).toEqual(['club.example.com', 'second.example.com']);
  });

  it('the same Club rejoined in one session is a new member: it still gets its copy', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(ok(200, rankingJson)));
    const { bridge, kv } = await setup(f);
    expect((await bridge.sendResult(payload))[0]?.outcome).toBe('sent');
    expect(f).toHaveBeenCalledTimes(1);

    // Disconnect, then join the same server again: the server issues a new member.
    await removeClubConnection(E, kv);
    await addClubConnection({ ...FAMILY, memberId: 'm_2', memberToken: 'secret-Family-2' }, kv);
    const reports = await bridge.sendResult(payload);
    expect(reports).toEqual([{ endpoint: E, clubName: 'Family', outcome: 'sent' }]);
    expect(f).toHaveBeenCalledTimes(2);
    expect((f.mock.calls[1]![1] as { headers: Record<string, string> }).headers.Authorization).toBe(
      'Bearer secret-Family-2',
    );

    // ...and that membership is settled like any other: a second mount sends nothing.
    await bridge.sendResult(payload);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('a result that failed is tried again by the next mount', async () => {
    const f = vi.fn().mockRejectedValueOnce(new TypeError('offline'));
    f.mockImplementation(() => Promise.resolve(ok(200, rankingJson)));
    const { bridge } = await setup(f);
    expect((await bridge.sendResult(payload))[0]?.outcome).toBe('queued');
    expect((await bridge.sendResult(payload))[0]?.outcome).toBe('sent');
  });

  it('a mount while the first try is still queued re-sends the same item under the same clientId, once', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('offline'));
    const { bridge, kv } = await setup(f);
    expect((await bridge.sendResult(payload))[0]?.outcome).toBe('queued');
    expect((await bridge.sendResult(payload))[0]?.outcome).toBe('queued');
    // Not two rows' worth: one item in the queue, retried with the token it was born with.
    const queued = await queuedRankings(E, kv);
    expect(queued).toHaveLength(1);
    expect(bodyOf(f, 0).clientId).toBe(queued[0]?.clientId);
    expect(bodyOf(f, 1).clientId).toBe(queued[0]?.clientId);

    f.mockReset().mockImplementation(() => Promise.resolve(ok(200, rankingJson)));
    expect((await bridge.sendResult(payload))[0]?.outcome).toBe('sent');
    expect(f).toHaveBeenCalledTimes(1);
    expect(bodyOf(f).clientId).toBe(queued[0]?.clientId);
    expect(await pendingFor(E, kv)).toEqual([]);
  });

  it('two mounts at once (a double effect) queue and send one item', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(ok(200, rankingJson)));
    const { bridge, kv } = await setup(f);
    const both = await Promise.all([bridge.sendResult(payload), bridge.sendResult(payload)]);
    expect(both.map((r) => r[0]?.outcome)).toEqual(['sent', 'sent']);
    expect(f).toHaveBeenCalledTimes(1);
    expect(await pendingFor(E, kv)).toEqual([]);
  });

  it('a sent result is not sent again by a later mount, even after the player deleted its row', async () => {
    // Deleting a row (club.md §9, 2026-10-10) does not reach the bridge: the
    // settled memo stays, because sending it again would be a second row.
    const f = vi.fn().mockImplementation(() => Promise.resolve(ok(200, rankingJson)));
    const { bridge } = await setup(f);
    await bridge.sendResult(payload);
    await bridge.sendResult(payload);
    await bridge.sendResult({ ...payload, facts: { ...payload.facts } });
    expect(paths(f)).toEqual(['/rankings/results']);
  });

  it('replaying a daily after the first result: the server says already, and so do we', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(err(409, 'already_submitted')));
    const { bridge } = await setup(f);
    expect((await bridge.sendResult(dailyPayload))[0]?.outcome).toBe('already');
    expect((await bridge.sendResult(dailyPayload))[0]?.outcome).toBe('already');
  });
});

describe('loadConnections', () => {
  it('returns summaries without tokens', async () => {
    const kv = createMemoryKV();
    await addClubConnection(FAMILY, kv);
    const list = await loadConnections(kv);
    expect(list).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain('secret-Family');
  });
});

describe('one play, one row (ClubResultPayload.playId, club.md §16-1)', () => {
  it('two plays that end with the same figures are two results; one play sent again is one', async () => {
    const f = vi.fn(async () => ok(201, rankingJson));
    const { bridge } = await setup(f);
    const first: ClubResultPayload = { ...payload, playId: 'play-1' };
    expect((await bridge.sendResult(first))[0]?.outcome).toBe('sent');
    // The same play again (a re-render, a late bridge): the memo answers, nothing is sent.
    expect((await bridge.sendResult(first))[0]?.outcome).toBe('sent');
    // Another play, the same figures: another result, its own clientId.
    expect((await bridge.sendResult({ ...payload, playId: 'play-2' }))[0]?.outcome).toBe('sent');
    expect(paths(f).filter((p) => p === '/rankings/results')).toHaveLength(2);
    expect(bodyOf(f, 0).clientId).not.toBe(bodyOf(f, 1).clientId);
  });
});
