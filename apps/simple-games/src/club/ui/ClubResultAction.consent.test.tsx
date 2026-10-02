/**
 * The result screen's line on a device whose connections have not all accepted
 * automatic sending (club.md §2-2, §4-1). Unlike ui/components/ClubResultAction
 * .test.tsx, which stands in for the bridge, this one runs the real bridge over
 * stored connections: consent is enforced where the request is made, so it is
 * the pair that has to hold.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV, type KVStore } from '@/storage/kv';
import { settingsSchema, type ClubConnection } from '@/storage/schemas';
import { ClubBridgeContext, type ClubBridge } from '@/ui/clubBridge';
import { ClubResultAction } from '@/ui/components/ClubResultAction';
import { createBridge, loadConnections } from '../bridge';
import { addClubConnection } from '../storage/connections';
import { pendingFor } from '../storage/outbox';

const E = 'https://club.example.com';
const F = 'https://second.example.com';
const connection = (endpoint: string, name: string, extra: Partial<ClubConnection> = {}) => ({
  endpoint,
  clubId: `c_${name}`,
  clubName: name,
  memberId: 'm_1',
  memberToken: `secret-${name}`,
  nickname: 'Ken',
  role: 'member' as const,
  joinedAt: 'x',
  ...extra,
});

const rankingJson = {
  gameId: 'sudoku',
  paramsKey: 'hard',
  improved: false,
  rank: 4,
  entry: null,
  entryCount: 9,
};

afterEach(cleanup);

async function mountWith(connections: readonly ClubConnection[]) {
  const kv: KVStore = createMemoryKV();
  for (const c of connections) await addClubConnection(c, kv);
  const f = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(rankingJson), { status: 200, headers: { 'X-Club-Api': '1' } }),
      ),
    );
  const { sendResult } = createBridge(kv, f as unknown as typeof fetch);
  const bridge: ClubBridge = { connections: await loadConnections(kv), sendResult };
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <ClubBridgeContext.Provider value={bridge}>
        <ClubResultAction
          gameId="sudoku"
          outcome="completed"
          details={[]}
          facts={{ elapsedSeconds: 271, mistakes: 0, hints: 1 }}
          seed="sudoku-club-1"
          params={{ difficulty: 'hard' }}
          boardDigest="sd1:1"
          daily={null}
        />
      </ClubBridgeContext.Provider>
    </SettingsProvider>,
  );
  await act(async () => {
    // The bridge reads storage, writes the outbox, then asks the fetch.
    for (let i = 0; i < 20; i++) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  return { f, kv };
}

describe('ClubResultAction over the real bridge', () => {
  it('with only unconsented connections it sends nothing, queues nothing and says nothing', async () => {
    const { f, kv } = await mountWith([connection(E, 'Family'), connection(F, 'Work')]);
    expect(f).not.toHaveBeenCalled();
    expect(await pendingFor(E, kv)).toEqual([]);
    expect(await pendingFor(F, kv)).toEqual([]);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('with one consented and one not it sends to the consented one alone and names only it', async () => {
    const { f } = await mountWith([
      connection(E, 'Family', { autoSend: true }),
      connection(F, 'Work'),
    ]);
    expect(f).toHaveBeenCalledTimes(1);
    expect(new URL(String(f.mock.calls[0]![0])).host).toBe('club.example.com');
    expect(screen.getByRole('status')).toHaveTextContent('Sent to Family');
  });
});
