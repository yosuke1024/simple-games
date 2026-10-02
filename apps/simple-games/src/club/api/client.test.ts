import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient, REQUEST_TIMEOUT_MS } from './client';
import { ClubApiError } from './errors';

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

  it('rotateInvite posts the member role', async () => {
    const f = vi.fn().mockResolvedValue(reply(200, { token: 't', url: 'u' }));
    await createClient(E, 't', f as unknown as typeof fetch).rotateInvite();
    expect(JSON.parse(f.mock.calls[0]![1].body)).toEqual({ role: 'member' });
  });

  it('refuses a server without X-Club-Api: 1, even on an error status', async () => {
    for (const headers of [{} as Record<string, string>, { 'X-Club-Api': '2' }]) {
      const f = vi
        .fn()
        .mockResolvedValue(reply(401, { error: { code: 'unauthorized', message: 'x' } }, headers));
      await expect(createClient(E, 't', f as unknown as typeof fetch).club()).rejects.toMatchObject(
        {
          code: 'unsupported_server',
        },
      );
    }
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
