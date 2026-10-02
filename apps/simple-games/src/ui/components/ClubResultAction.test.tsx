/**
 * The Club House's line on a result screen (docs/architecture/club.md §2-2):
 * no button, one send per result to every Club joined, and one status line.
 * The bridge is a stand-in here; src/club/bridge.test.ts owns what it does.
 */
import { StrictMode, type ReactNode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { en } from '../../i18n/locales/en';
import { SettingsProvider } from '../../state/SettingsContext';
import { settingsSchema } from '../../storage/schemas';
import {
  ClubBridgeContext,
  type ClubBridge,
  type ClubConnectionSummary,
  type ClubResultPayload,
  type ClubSendOutcome,
  type ClubSendReport,
} from '../clubBridge';
import { ClubResultAction, type ClubResultActionProps } from './ClubResultAction';

const club = (name: string): ClubConnectionSummary => ({
  endpoint: `https://${name.toLowerCase()}.example.com`,
  clubId: `c_${name}`,
  clubName: name,
  nickname: 'Ken',
  role: 'member',
});
const FAMILY = club('Family');
const WORK = club('Work');
const GYM = club('Gym');

const reportFor = (c: ClubConnectionSummary, outcome: ClubSendOutcome): ClubSendReport => ({
  endpoint: c.endpoint,
  clubName: c.clubName,
  outcome,
});

const props: ClubResultActionProps = {
  gameId: 'sudoku',
  outcome: 'completed',
  details: [],
  facts: { elapsedSeconds: 271, mistakes: 0, hints: 1 },
  seed: 'sudoku-daily-2026-10-02',
  params: { difficulty: 'hard' },
  boardDigest: 'sd1:1',
  daily: '2026-10-02',
};

function makeBridge(
  connections: readonly ClubConnectionSummary[],
  answer: (payload: ClubResultPayload) => Promise<readonly ClubSendReport[]>,
) {
  const sendResult = vi.fn(answer);
  const bridge: ClubBridge = { connections, sendResult };
  return { bridge, sendResult };
}

/** A bridge that answers every connection with the same outcome. */
const answering = (connections: readonly ClubConnectionSummary[], outcome: ClubSendOutcome) =>
  makeBridge(connections, () => Promise.resolve(connections.map((c) => reportFor(c, outcome))));

function shell(bridge: ClubBridge | null, children: ReactNode, strict = false) {
  const tree = (
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <ClubBridgeContext.Provider value={bridge}>{children}</ClubBridgeContext.Provider>
    </SettingsProvider>
  );
  return strict ? <StrictMode>{tree}</StrictMode> : tree;
}

const settle = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

async function mount(
  bridge: ClubBridge | null,
  over: Partial<ClubResultActionProps> = {},
  strict = false,
) {
  const view = render(shell(bridge, <ClubResultAction {...props} {...over} />, strict));
  await settle();
  return view;
}

afterEach(cleanup);

describe('sending', () => {
  it('sends the result as the screen appears, with every field the game gave', async () => {
    const { bridge, sendResult } = answering([FAMILY], 'sent');
    await mount(bridge);
    expect(sendResult).toHaveBeenCalledTimes(1);
    expect(sendResult).toHaveBeenCalledWith({
      gameId: 'sudoku',
      outcome: 'completed',
      facts: { elapsedSeconds: 271, mistakes: 0, hints: 1 },
      seed: 'sudoku-daily-2026-10-02',
      params: { difficulty: 'hard' },
      boardDigest: 'sd1:1',
      daily: '2026-10-02',
    });
  });

  it('draws no button: there is nothing to press', async () => {
    const { bridge } = answering([FAMILY, WORK], 'sent');
    await mount(bridge);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('sends once under StrictMode, which mounts twice', async () => {
    const { bridge, sendResult } = answering([FAMILY], 'sent');
    await mount(bridge, {}, true);
    expect(sendResult).toHaveBeenCalledTimes(1);
    // ...and the answer still reaches the screen after the simulated remount.
    expect(screen.getByRole('status')).toHaveTextContent('Sent to Family');
  });

  it('sends once however often the result screen re-renders with fresh figures', async () => {
    const { bridge, sendResult } = answering([FAMILY], 'sent');
    const { rerender } = await mount(bridge);
    for (let i = 0; i < 3; i++) {
      rerender(
        shell(bridge, <ClubResultAction {...props} facts={{ ...(props.facts as object) }} />),
      );
      await settle();
    }
    expect(sendResult).toHaveBeenCalledTimes(1);
  });

  it('waits for a bridge that arrives late, then sends once', async () => {
    const { bridge, sendResult } = answering([FAMILY], 'sent');
    const { rerender } = await mount(null);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    rerender(shell(bridge, <ClubResultAction {...props} />));
    await settle();
    expect(sendResult).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Sent to Family');

    // A new bridge (the Club list changed) does not send the same result again.
    const next = answering([FAMILY, WORK], 'sent');
    rerender(shell(next.bridge, <ClubResultAction {...props} />));
    await settle();
    expect(next.sendResult).not.toHaveBeenCalled();
    expect(sendResult).toHaveBeenCalledTimes(1);
  });

  it('waits for a Club to be joined if the bridge has none yet', async () => {
    const empty = answering([], 'sent');
    const { rerender } = await mount(empty.bridge);
    expect(empty.sendResult).not.toHaveBeenCalled();
    const joined = answering([FAMILY], 'sent');
    rerender(shell(joined.bridge, <ClubResultAction {...props} />));
    await settle();
    expect(joined.sendResult).toHaveBeenCalledTimes(1);
  });

  it('leaving the screen does not cancel the send, and nothing is drawn or thrown afterwards', async () => {
    let finish!: (reports: readonly ClubSendReport[]) => void;
    const { bridge, sendResult } = makeBridge(
      [FAMILY],
      () => new Promise((resolve) => (finish = resolve)),
    );
    const { unmount } = await mount(bridge);
    expect(sendResult).toHaveBeenCalledTimes(1);
    unmount();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await act(async () => {
      finish([reportFor(FAMILY, 'sent')]);
      await Promise.resolve();
    });
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});

describe('what it sends nothing for', () => {
  it('draws nothing and sends nothing without a bridge', async () => {
    const { container } = await mount(null);
    expect(container).toBeEmptyDOMElement();
  });

  it('draws nothing and sends nothing with no Club joined', async () => {
    const { bridge, sendResult } = answering([], 'sent');
    const { container } = await mount(bridge);
    expect(container).toBeEmptyDOMElement();
    expect(sendResult).not.toHaveBeenCalled();
  });

  it('a played result (a loss, a dead end) is never sent, and the line stays blank', async () => {
    const { bridge, sendResult } = answering([FAMILY, WORK], 'sent');
    await mount(bridge, { outcome: 'played' });
    expect(sendResult).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});

describe('the status line', () => {
  const lineFor = async (
    connections: readonly ClubConnectionSummary[],
    outcomes: readonly ClubSendOutcome[],
  ) => {
    cleanup();
    const { bridge } = makeBridge(connections, () =>
      Promise.resolve(connections.map((c, i) => reportFor(c, outcomes[i]!))),
    );
    await mount(bridge);
    return screen.getByRole('status');
  };

  it('is there, blank, from the first moment, so the layout does not move', async () => {
    const { bridge } = makeBridge([FAMILY], () => new Promise(() => undefined));
    await mount(bridge);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  describe('one Club', () => {
    it('sent', async () => {
      expect(await lineFor([FAMILY], ['sent'])).toHaveTextContent(
        en.clubResultSent.replace('{club}', 'Family'),
      );
    });
    it('queued', async () => {
      expect(await lineFor([FAMILY], ['queued'])).toHaveTextContent(en.clubResultPending);
    });
    it('rejected', async () => {
      expect(await lineFor([FAMILY], ['rejected'])).toHaveTextContent(
        en.clubResultNotSent.replace('{club}', 'Family'),
      );
    });
    it('already: the first result stands, so nothing is said', async () => {
      expect(await lineFor([FAMILY], ['already'])).toBeEmptyDOMElement();
    });
  });

  describe('several Clubs', () => {
    it('all sent', async () => {
      expect(await lineFor([FAMILY, WORK, GYM], ['sent', 'sent', 'sent'])).toHaveTextContent(
        en.clubResultSentMany.replace('{count}', '3'),
      );
    });
    it('all queued', async () => {
      expect(await lineFor([FAMILY, WORK], ['queued', 'queued'])).toHaveTextContent(
        en.clubResultPending,
      );
    });
    it('some sent, some queued', async () => {
      expect(await lineFor([FAMILY, WORK, GYM], ['sent', 'queued', 'sent'])).toHaveTextContent(
        en.clubResultPartial.replace('{sent}', '2').replace('{count}', '3'),
      );
    });
    it('names the Clubs that refused it', async () => {
      expect(
        await lineFor([FAMILY, WORK, GYM], ['sent', 'rejected', 'rejected']),
      ).toHaveTextContent(en.clubResultNotSent.replace('{club}', 'Work, Gym'));
    });
    it('does not count a Club that already had the result', async () => {
      // Two left that count: one sent, one queued.
      expect(await lineFor([FAMILY, WORK, GYM], ['already', 'sent', 'queued'])).toHaveTextContent(
        en.clubResultPartial.replace('{sent}', '1').replace('{count}', '2'),
      );
      // One left that counts: the single-Club words, with that Club's name.
      expect(await lineFor([FAMILY, WORK], ['already', 'sent'])).toHaveTextContent(
        en.clubResultSent.replace('{club}', 'Work'),
      );
    });
    it('every Club already had it: nothing is said', async () => {
      expect(await lineFor([FAMILY, WORK], ['already', 'already'])).toBeEmptyDOMElement();
    });
  });

  it('an empty answer (a bridge that could not read its connections) leaves the line blank', async () => {
    const { bridge } = makeBridge([FAMILY], () => Promise.resolve([]));
    await mount(bridge);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
