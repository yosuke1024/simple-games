import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient, REQUEST_TIMEOUT_MS } from './client';
import { ClubApiError, isFinalError } from './errors';

const club = { id: 'c_1', name: 'Family', createdAt: 'x' };
const member = { id: 'm_7', nickname: 'Ken', role: 'member', joinedAt: 'x' };
const challenge = {
  id: 'ch_1',
  gameId: 'sudoku',
  contractVersion: 1,
  params: {},
  seed: 's',
  boardDigest: 'sd1:1',
  title: null,
  createdBy: { id: 'm_7', nickname: 'Ken' },
  createdAt: 'x',
  resultCount: 1,
  mine: true,
};

function reply(
  status: number,
  body: unknown,
  headers: Record<string, string> = { 'X-Club-Api': '1' },
) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers });
}

const E = 'https://club.example.com';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('club client', () => {
  it('join: POST without a token', async () => {
    const f = vi.fn().mockResolvedValue(reply(200, { club, member, memberToken: 'tok' }));
    const res = await createClient(E, null, f as unknown as typeof fetch).join('inv', 'Ken');
    expect(res.memberToken).toBe('tok');
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe(`${E}/api/v1/join`);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBeUndefined();
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ inviteToken: 'inv', nickname: 'Ken' });
  });

  it('uses the global fetch by default and sends the bearer token', async () => {
    const f = vi.fn().mockResolvedValue(reply(200, [challenge]));
    vi.stubGlobal('fetch', f);
    const list = await createClient(E, 'secret').challenges({ after: 'ch_0' });
    expect(list).toHaveLength(1);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe(`${E}/api/v1/challenges?after=ch_0`);
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer secret');
    expect(init.body).toBeUndefined();
  });

  it('createChallenge and submitResult send their bodies verbatim', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(reply(201, challenge))
      .mockResolvedValueOnce(
        reply(201, {
          memberId: 'm',
          nickname: 'n',
          submittedAt: 'x',
          outcome: 'completed',
          facts: {},
        }),
      );
    const client = createClient(E, 't', f as unknown as typeof fetch);
    const create = {
      gameId: 'sudoku',
      contractVersion: 1 as const,
      params: { difficulty: 'hard' },
      seed: 's',
      boardDigest: 'sd1:1',
      title: null,
      result: { outcome: 'completed' as const, facts: { elapsedSeconds: 1 } },
    };
    await client.createChallenge(create);
    expect(f.mock.calls[0]![0]).toBe(`${E}/api/v1/challenges`);
    expect(JSON.parse(f.mock.calls[0]![1].body)).toEqual(create);
    const sub = {
      contractVersion: 1 as const,
      boardDigest: 'sd1:1',
      outcome: 'completed' as const,
      facts: { elapsedSeconds: 2 },
    };
    await client.submitResult('ch_1', sub);
    expect(f.mock.calls[1]![0]).toBe(`${E}/api/v1/challenges/ch_1/results`);
    expect(JSON.parse(f.mock.calls[1]![1].body)).toEqual(sub);
  });

  it('removeMember: DELETE, 204 resolves void', async () => {
    const f = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204, headers: { 'X-Club-Api': '1' } }));
    await expect(
      createClient(E, 't', f as unknown as typeof fetch).removeMember('m_1'),
    ).resolves.toBeUndefined();
    expect(f.mock.calls[0]![0]).toBe(`${E}/api/v1/members/m_1`);
    expect(f.mock.calls[0]![1].method).toBe('DELETE');
  });

  it('removeMember with purge adds ?purge=1', async () => {
    const f = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204, headers: { 'X-Club-Api': '1' } }));
    await createClient(E, 't', f as unknown as typeof fetch).removeMember('m_1', { purge: true });
    expect(f.mock.calls[0]![0]).toBe(`${E}/api/v1/members/m_1?purge=1`);
    expect(f.mock.calls[0]![1].method).toBe('DELETE');
  });

  it('reportMember posts without a body; reportedMembers and renameMember validate', async () => {
    const member = {
      id: 'm_2',
      nickname: 'Mika',
      role: 'member',
      joinedAt: '2026-09-09T00:00:00Z',
    };
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204, headers: { 'X-Club-Api': '1' } }))
      .mockResolvedValueOnce(reply(200, [{ member, reportCount: 3 }]))
      .mockResolvedValueOnce(reply(200, { ...member, nickname: 'Mi' }))
      .mockResolvedValueOnce(reply(200, [{ member, reportCount: 'x' }]));
    const client = createClient(E, 't', f as unknown as typeof fetch);
    await expect(client.reportMember('m_2')).resolves.toBeUndefined();
    expect(f.mock.calls[0]![0]).toBe(`${E}/api/v1/members/m_2/report`);
    expect(f.mock.calls[0]![1].method).toBe('POST');
    expect(f.mock.calls[0]![1].body).toBeUndefined();
    expect(await client.reportedMembers()).toEqual([{ member, reportCount: 3 }]);
    expect(f.mock.calls[1]![0]).toBe(`${E}/api/v1/members/reported`);
    expect((await client.renameMember('m_2', 'Mi')).nickname).toBe('Mi');
    expect(f.mock.calls[2]![0]).toBe(`${E}/api/v1/members/m_2`);
    expect(f.mock.calls[2]![1].method).toBe('PATCH');
    expect(JSON.parse(f.mock.calls[2]![1].body)).toEqual({ nickname: 'Mi' });
    await expect(client.reportedMembers()).rejects.toMatchObject({ code: 'malformed_response' });
  });

  it('renameSelf PATCHes /me and validates the member', async () => {
    const member = {
      id: 'm_1',
      nickname: 'Kenji',
      role: 'member',
      joinedAt: '2026-09-09T00:00:00Z',
    };
    const f = vi
      .fn()
      .mockResolvedValueOnce(reply(200, member))
      .mockResolvedValueOnce(reply(200, { nickname: 1 }));
    const client = createClient(E, 't', f as unknown as typeof fetch);
    expect((await client.renameSelf('Kenji')).nickname).toBe('Kenji');
    expect(f.mock.calls[0]![0]).toBe(`${E}/api/v1/me`);
    expect(f.mock.calls[0]![1].method).toBe('PATCH');
    expect(JSON.parse(f.mock.calls[0]![1].body)).toEqual({ nickname: 'Kenji' });
    await expect(client.renameSelf('x')).rejects.toMatchObject({ code: 'malformed_response' });
  });

  it('deleteMyRanking and deleteMyResult DELETE the caller’s own row, encoded, with no body', async () => {
    const f = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(null, { status: 204, headers: { 'X-Club-Api': '1' } })),
      );
    const client = createClient(E, 't', f as unknown as typeof fetch);
    await expect(client.deleteMyRanking('sudoku', 'hard/x')).resolves.toBeUndefined();
    expect(f.mock.calls[0]![0]).toBe(`${E}/api/v1/rankings/sudoku/hard%2Fx/me`);
    expect(f.mock.calls[0]![1].method).toBe('DELETE');
    expect(f.mock.calls[0]![1].body).toBeUndefined();
    await expect(client.deleteMyResult('ch_1')).resolves.toBeUndefined();
    expect(f.mock.calls[1]![0]).toBe(`${E}/api/v1/challenges/ch_1/results/me`);
    expect(f.mock.calls[1]![1].method).toBe('DELETE');
    expect(f.mock.calls[1]![1].body).toBeUndefined();
  });

  it('deleteMyEntry DELETEs one row of the caller’s by its id, encoded, with no body', async () => {
    const f = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(null, { status: 204, headers: { 'X-Club-Api': '1' } })),
      );
    const client = createClient(E, 't', f as unknown as typeof fetch);
    await expect(client.deleteMyEntry('sudoku', 'hard/x', '12')).resolves.toBeUndefined();
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe(`${E}/api/v1/rankings/sudoku/hard%2Fx/entries/12`);
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.headers.Authorization).toBe('Bearer t');
  });

  it('a 404 on a delete is the not_found error the screens tolerate', async () => {
    const f = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(reply(404, { error: { code: 'not_found', message: 'no' } })),
      );
    const client = createClient(E, 't', f as unknown as typeof fetch);
    await expect(client.deleteMyRanking('sudoku', 'hard')).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(client.deleteMyResult('ch_1')).rejects.toMatchObject({ code: 'not_found' });
    await expect(client.deleteMyEntry('sudoku', 'hard', '12')).rejects.toMatchObject({
      code: 'not_found',
      status: 404,
    });
  });

  it('rotateInvite posts the member role', async () => {
    const f = vi.fn().mockResolvedValue(reply(200, { token: 't', url: 'u' }));
    await createClient(E, 't', f as unknown as typeof fetch).rotateInvite();
    expect(JSON.parse(f.mock.calls[0]![1].body)).toEqual({ role: 'member' });
  });

  it('refuses a server whose X-Club-Api is not 1, even on an error status', async () => {
    const f = vi
      .fn()
      .mockResolvedValue(
        reply(401, { error: { code: 'unauthorized', message: 'x' } }, { 'X-Club-Api': '2' }),
      );
    await expect(createClient(E, 't', f as unknown as typeof fetch).club()).rejects.toMatchObject({
      code: 'unsupported_server',
    });
  });

  it('treats a response with no X-Club-Api as unreachable, never as a verdict on the server', async () => {
    // A platform error page (quota used up, gateway down) is not the Club server:
    // a queued result must wait it out instead of being dropped as unsupported.
    for (const status of [403, 429, 502]) {
      const f = vi.fn().mockResolvedValue(reply(status, 'error page', {}));
      await expect(createClient(E, 't', f as unknown as typeof fetch).club()).rejects.toMatchObject(
        { code: 'unreachable', status },
      );
    }
    expect(isFinalError(new ClubApiError('unreachable', 502))).toBe(false);
  });

  it('maps the error envelope, keeping the status; unknown codes become internal_error', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(reply(409, { error: { code: 'already_submitted', message: 'x' } }))
      .mockResolvedValueOnce(reply(418, { error: { code: 'teapot', message: 'x' } }))
      .mockResolvedValueOnce(reply(502, 'not json'));
    const client = createClient(E, 't', f as unknown as typeof fetch);
    await expect(client.club()).rejects.toMatchObject({ code: 'already_submitted', status: 409 });
    await expect(client.club()).rejects.toMatchObject({ code: 'internal_error', status: 418 });
    await expect(client.club()).rejects.toBeInstanceOf(ClubApiError);
  });

  it('network failure is unreachable', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(createClient(E, 't', f as unknown as typeof fetch).club()).rejects.toMatchObject({
      code: 'unreachable',
      status: null,
    });
  });

  it('times out after 10 seconds as unreachable', async () => {
    vi.useFakeTimers();
    const f = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init.signal!.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const promise = createClient(E, 't', f as unknown as typeof fetch).club();
    const assertion = expect(promise).rejects.toMatchObject({ code: 'unreachable' });
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await assertion;
  });

  describe('a request settles within the timeout even when the platform never settles it (club.md §10)', () => {
    // A WKWebView with no network can leave a fetch pending after the abort, and
    // a body that never finishes. The 10 s limit must not depend on either.
    it('a fetch that ignores the abort signal and never answers is unreachable at the deadline', async () => {
      vi.useFakeTimers();
      let signal: AbortSignal | undefined;
      const f = vi.fn((_url: string, init: RequestInit) => {
        signal = init.signal ?? undefined;
        return new Promise<Response>(() => {});
      });
      let outcome: unknown = 'pending';
      createClient(E, 't', f as unknown as typeof fetch)
        .club()
        .then(
          () => (outcome = 'resolved'),
          (e: unknown) => (outcome = e),
        );
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
      expect(outcome).toBe('pending');
      await vi.advanceTimersByTimeAsync(1);
      expect(outcome).toBeInstanceOf(ClubApiError);
      expect(outcome).toMatchObject({ code: 'unreachable', status: null });
      // It still asks the platform to drop the request.
      expect(signal?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('a response whose body never finishes is unreachable at the deadline too', async () => {
      vi.useFakeTimers();
      const stalled = {
        status: 200,
        ok: true,
        headers: new Headers({ 'X-Club-Api': '1' }),
        json: () => new Promise<unknown>(() => {}),
      } as unknown as Response;
      const f = vi.fn().mockResolvedValue(stalled);
      let outcome: unknown = 'pending';
      createClient(E, 't', f as unknown as typeof fetch)
        .club()
        .then(
          () => (outcome = 'resolved'),
          (e: unknown) => (outcome = e),
        );
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
      expect(outcome).toBe('pending');
      await vi.advanceTimersByTimeAsync(1);
      expect(outcome).toMatchObject({ code: 'unreachable', status: null });
      expect(vi.getTimerCount()).toBe(0);
    });

    it('an error answer whose body never finishes is unreachable (not the 500) at the deadline', async () => {
      vi.useFakeTimers();
      const stalled = {
        status: 500,
        ok: false,
        headers: new Headers({ 'X-Club-Api': '1' }),
        json: () => new Promise<unknown>(() => {}),
      } as unknown as Response;
      const f = vi.fn().mockResolvedValue(stalled);
      let outcome: unknown = 'pending';
      createClient(E, 't', f as unknown as typeof fetch)
        .club()
        .then(
          () => (outcome = 'resolved'),
          (e: unknown) => (outcome = e),
        );
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
      expect(outcome).toBe('pending');
      await vi.advanceTimersByTimeAsync(1);
      // The status is the network's trouble to the caller (null), not the 500 it half-read.
      expect(outcome).toBeInstanceOf(ClubApiError);
      expect(outcome).toMatchObject({ code: 'unreachable', status: null });
      expect(vi.getTimerCount()).toBe(0);
    });

    it('a device that knows it is offline is unreachable at once, without a request or a timer', async () => {
      vi.useFakeTimers();
      const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      try {
        const f = vi.fn().mockResolvedValue(reply(200, { club }));
        // No timer is advanced: the answer is already there.
        await expect(
          createClient(E, 't', f as unknown as typeof fetch).club(),
        ).rejects.toMatchObject({ code: 'unreachable', status: null });
        expect(f).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        online.mockRestore();
      }
    });

    it('a normal answer is unaffected and leaves no timer behind', async () => {
      vi.useFakeTimers();
      const f = vi.fn().mockResolvedValue(reply(200, { ok: true, api: 1, claimed: false }));
      await expect(
        createClient(E, null, f as unknown as typeof fetch).health(),
      ).resolves.toMatchObject({ ok: true, api: 1 });
      expect(f).toHaveBeenCalledTimes(1);
      // The deadline was cancelled: nothing fires later and aborts a finished request.
      expect(vi.getTimerCount()).toBe(0);
    });

    it('an error answer leaves no timer behind either', async () => {
      vi.useFakeTimers();
      const f = vi
        .fn()
        .mockResolvedValue(reply(401, { error: { code: 'unauthorized', message: 'x' } }));
      await expect(createClient(E, 't', f as unknown as typeof fetch).club()).rejects.toMatchObject(
        {
          code: 'unauthorized',
          status: 401,
        },
      );
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it('malformed JSON shapes are malformed_response', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(reply(200, { club }))
      .mockResolvedValueOnce(reply(200, { not: 'a list' }))
      .mockResolvedValueOnce(reply(200, [{ id: 1 }]));
    const client = createClient(E, 't', f as unknown as typeof fetch);
    await expect(client.club()).rejects.toMatchObject({ code: 'malformed_response' });
    await expect(client.challenges()).rejects.toMatchObject({ code: 'malformed_response' });
    await expect(client.records()).rejects.toMatchObject({ code: 'malformed_response' });
  });

  it('joins an open server with a nickname alone', async () => {
    const f = vi.fn().mockResolvedValue(reply(201, { club, member, memberToken: 'tok' }));
    await createClient(E, null, f as unknown as typeof fetch).join(null, 'Ken');
    expect(JSON.parse(f.mock.calls[0]![1].body)).toEqual({ nickname: 'Ken' });
  });

  it('builds the challenges query from after and daily', async () => {
    const f = vi.fn().mockImplementation(async () => reply(200, [challenge]));
    const client = createClient(E, 't', f as unknown as typeof fetch);
    await client.challenges({ daily: '2026-10-02' });
    await client.challenges({ after: 'ch 0', daily: '2026-10-02' });
    expect(f.mock.calls[0]![0]).toBe(`${E}/api/v1/challenges?daily=2026-10-02`);
    expect(f.mock.calls[1]![0]).toBe(`${E}/api/v1/challenges?after=ch%200&daily=2026-10-02`);
  });

  it('submitRanking posts the body and reads the answer', async () => {
    const entry = {
      id: '41',
      memberId: 'm_7',
      nickname: 'Ken',
      submittedAt: 'x',
      facts: {},
      seed: 's',
      boardDigest: null,
    };
    const f = vi.fn().mockResolvedValue(
      reply(201, {
        gameId: '2048',
        paramsKey: 'standard',
        improved: false,
        entry,
        entryCount: 9,
      }),
    );
    const body = {
      gameId: '2048',
      contractVersion: 1 as const,
      paramsKey: 'standard',
      params: {},
      seed: 's',
      boardDigest: null,
      outcome: 'completed' as const,
      facts: { score: 10 },
    };
    const res = await createClient(E, 't', f as unknown as typeof fetch).submitRanking(body);
    expect(f.mock.calls[0]![0]).toBe(`${E}/api/v1/rankings/results`);
    expect(f.mock.calls[0]![1].method).toBe('POST');
    expect(JSON.parse(f.mock.calls[0]![1].body)).toEqual(body);
    expect(res).toMatchObject({ improved: false, entryCount: 9 });
    expect(res.entry?.id).toBe('41');
    expect('rank' in res).toBe(false); // the result screen shows no rank (club.md §2-2)
  });

  it('rankings and ranking read the tables', async () => {
    const entry = {
      id: '3',
      memberId: 'm_7',
      nickname: 'Ken',
      submittedAt: 'x',
      facts: {},
      seed: 's',
      boardDigest: 'd',
    };
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        reply(200, [{ gameId: 'sudoku', paramsKey: 'hard', entryCount: 2, leader: entry }]),
      )
      .mockResolvedValueOnce(
        reply(200, {
          gameId: 'sudoku',
          paramsKey: 'hard',
          entryCount: 2,
          entries: [entry],
          me: { rank: 1, entry, nextValue: null },
        }),
      )
      .mockResolvedValueOnce(reply(200, { gameId: 'sudoku' }));
    const client = createClient(E, 't', f as unknown as typeof fetch);
    expect((await client.rankings())[0]!.leader.nickname).toBe('Ken');
    const table = await client.ranking('sudoku', 'hard', 50);
    expect(table.me).toEqual({ rank: 1, entry, nextValue: null });
    expect(table.entries[0]!.id).toBe('3');
    expect(f.mock.calls[0]![0]).toBe(`${E}/api/v1/rankings`);
    expect(f.mock.calls[1]![0]).toBe(`${E}/api/v1/rankings/sudoku/hard?top=50`);
    await expect(client.ranking('sudoku', 'hard')).rejects.toMatchObject({
      code: 'malformed_response',
    });
    expect(f.mock.calls[2]![0]).toBe(`${E}/api/v1/rankings/sudoku/hard`);
  });

  describe('rankingsMine (GET /rankings/mine, club.md §5-4)', () => {
    const entry = {
      id: '3',
      memberId: 'm_7',
      nickname: 'Ken',
      submittedAt: 'x',
      facts: {},
      seed: 's',
      boardDigest: 'd',
    };
    const row = {
      gameId: 'sudoku',
      paramsKey: 'hard',
      entryCount: 4,
      leader: entry,
      best: { rank: 2, entry: { ...entry, id: '9' }, nextValue: 305 },
    };

    it('GETs the route with no body and reads each table', async () => {
      const other = { ...row, gameId: 'minesweeper', paramsKey: 'easy' };
      const f = vi.fn().mockResolvedValue(reply(200, [row, other]));
      const list = await createClient(E, 't', f as unknown as typeof fetch).rankingsMine();
      expect(list).toEqual([row, other]);
      expect(f).toHaveBeenCalledTimes(1);
      const [url, init] = f.mock.calls[0]!;
      expect(url).toBe(`${E}/api/v1/rankings/mine`);
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
      expect(init.headers.Authorization).toBe('Bearer t');
    });

    it('an empty list is a caller who is in no table, not an error', async () => {
      const f = vi.fn().mockResolvedValue(reply(200, []));
      await expect(
        createClient(E, 't', f as unknown as typeof fetch).rankingsMine(),
      ).resolves.toEqual([]);
    });

    it('fills in what an older reply leaves out: no rank, no nextValue, no entry id', async () => {
      const { id: _id, ...oldEntry } = entry;
      const f = vi
        .fn()
        .mockResolvedValue(
          reply(200, [{ ...row, leader: oldEntry, best: { rank: null, entry: oldEntry } }]),
        );
      const [only] = await createClient(E, 't', f as unknown as typeof fetch).rankingsMine();
      expect(only!.leader.id).toBeNull();
      expect(only!.best).toEqual({ rank: null, entry: { ...entry, id: null }, nextValue: null });
    });

    it('one malformed element makes the whole answer malformed_response', async () => {
      const f = vi
        .fn()
        .mockResolvedValueOnce(reply(200, [row, { ...row, best: { rank: 0, entry } }]))
        .mockResolvedValueOnce(reply(200, [{ ...row, leader: undefined }]))
        .mockResolvedValueOnce(reply(200, [{ ...row, entryCount: 'many' }]))
        .mockResolvedValueOnce(reply(200, { not: 'a list' }));
      const client = createClient(E, 't', f as unknown as typeof fetch);
      for (let i = 0; i < 4; i++) {
        await expect(client.rankingsMine()).rejects.toMatchObject({
          code: 'malformed_response',
        });
      }
    });

    it('a server without the route answers 404, which surfaces as not_found so the screen can leave the section out', async () => {
      const f = vi
        .fn()
        .mockResolvedValue(reply(404, { error: { code: 'not_found', message: 'no' } }));
      const failure = await createClient(E, 't', f as unknown as typeof fetch)
        .rankingsMine()
        .then(
          () => null,
          (e: unknown) => e,
        );
      expect(failure).toBeInstanceOf(ClubApiError);
      expect(failure).toMatchObject({ code: 'not_found', status: 404 });
    });
  });

  it('health needs no token', async () => {
    const f = vi.fn().mockResolvedValue(reply(200, { ok: true, api: 1, claimed: false }));
    expect(await createClient(E, null, f as unknown as typeof fetch).health()).toEqual({
      ok: true,
      api: 1,
      claimed: false,
      open: false,
    });
  });

  it('health reports an open server', async () => {
    const f = vi
      .fn()
      .mockResolvedValue(reply(200, { ok: true, api: 1, claimed: true, open: true }));
    expect((await createClient(E, null, f as unknown as typeof fetch).health()).open).toBe(true);
  });
});
