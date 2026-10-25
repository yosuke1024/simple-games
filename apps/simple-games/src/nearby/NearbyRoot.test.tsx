import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { Setup } from './controller';
import type { Gathering } from './history';
import type { Session, Wire } from './session';
import { CATEGORIES } from './yacht';
import { en } from './i18n/en';
import { NearbyRoot } from './NearbyRoot';

interface FixtureController {
  setup: Setup;
  state: string;
  session: Session;
  peer: Session;
  queue: Array<{ receiver: 'local' | 'peer'; wire: Wire }>;
  start: Mock<() => Promise<void>>;
  connect: Mock<(id: string) => Promise<void>>;
  stop: Mock<() => Promise<void>>;
  establish: () => void;
  flush: () => void;
}

const fixtures = vi.hoisted(() => ({
  controllers: [] as FixtureController[],
  saved: [] as Gathering[],
  load: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
  radio: { start: vi.fn(), connect: vi.fn(), send: vi.fn(), stop: vi.fn() },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
  registerPlugin: () => fixtures.radio,
}));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn() } }));
vi.mock('../state/SettingsContext', async () => {
  const { translate } = await import('../i18n');
  return {
    useSettings: () => ({
      locale: 'en',
      settings: { reducedMotion: true },
      t: (key: Parameters<typeof translate>[1], vars?: Parameters<typeof translate>[2]) =>
        translate('en', key, vars),
    }),
  };
});
vi.mock('./history', () => ({
  loadHistory: fixtures.load,
  deleteGathering: fixtures.remove,
  clearHistory: fixtures.clear,
}));

// Native lifecycle and persistence have their own tests. This seam exposes
// asynchronous delivery explicitly while retaining the real admission/chat/game
// protocol, so UI tests cannot bypass mutual Ready by assigning a fake match.
vi.mock('./controller', async () => {
  const { Session } = await import('./session');
  class FakeController {
    state = 'idle';
    reason = 'ended';
    peers = [{ id: 'peer-1', name: 'F-ABC123' }];
    label = 'F-ABC123';
    code = '123456';
    storageFailed = false;
    gathering: Gathering | null = null;
    session: Session;
    peer: Session;
    queue: FixtureController['queue'] = [];

    constructor(
      readonly setup: Setup,
      private readonly changed: () => void,
    ) {
      this.session = new Session({
        host: setup.host,
        name: setup.name,
        nonce: 'a'.repeat(32),
        identity: 'c'.repeat(32),
        die: () => 6,
        send: (wire) => this.queue.push({ receiver: 'peer', wire }),
        changed: () => {
          if (this.session.paired) {
            this.state = this.session.suspended ? 'reconnecting' : 'room';
            this.gathering ??= {
              id: this.session.sid,
              at: 1000,
              label: this.label,
              transport: setup.transport,
              host: setup.host,
              names: this.session.names as [string, string],
              messages: [],
              games: [],
            };
          }
          this.changed();
        },
      });
      this.peer = new Session({
        host: !setup.host,
        name: setup.host ? 'Guest' : 'Host',
        nonce: 'b'.repeat(32),
        identity: 'd'.repeat(32),
        die: () => 6,
        send: (wire) => this.queue.push({ receiver: 'local', wire }),
        changed: () => {},
      });
      fixtures.controllers.push(this);
    }
    start = vi.fn(async () => {
      this.state = 'discovering';
      this.changed();
    });
    connect = vi.fn(async (_id: string) => this.establish());
    stop = vi.fn(async () => {
      this.session.end('Ended locally', false);
      this.state = 'ended';
      this.changed();
    });
    block = vi.fn(async () => this.stop());
    establish() {
      this.state = 'connecting';
      this.session.start();
      this.peer.start();
      this.flush();
    }
    flush() {
      let count = 0;
      while (this.queue.length) {
        if (++count > 100) throw new Error('Unexpected protocol loop');
        const next = this.queue.shift()!;
        (next.receiver === 'local' ? this.session : this.peer).receive(JSON.stringify(next.wire));
      }
      this.changed();
    }
  }
  return { NearbyController: FakeController };
});

function savedGathering(): Gathering {
  return {
    id: 'e'.repeat(32),
    at: 1000,
    endedAt: 2000,
    label: 'F-ABC123',
    transport: 'ble',
    host: true,
    names: ['Saved host', 'Saved guest'],
    messages: [
      { id: 'old-1', sender: 'self', text: 'Saved locally', status: 'delivered', at: 1500 },
    ],
    games: [{ round: 1, at: 1400, finished: true, scores: [21, 18] }],
  };
}

beforeEach(() => {
  fixtures.controllers.length = 0;
  fixtures.saved = [];
  vi.clearAllMocks();
  fixtures.load.mockImplementation(async () => ({
    version: 1,
    identity: 'c'.repeat(32),
    blocked: [],
    gatherings: structuredClone(fixtures.saved),
  }));
  fixtures.remove.mockImplementation(async (id: string) => {
    fixtures.saved = fixtures.saved.filter((g) => g.id !== id);
  });
  fixtures.clear.mockImplementation(async () => {
    fixtures.saved = [];
  });
});
afterEach(cleanup);

function begin(host = true) {
  fireEvent.click(screen.getByRole('button', { name: host ? en.create : en.join }));
  fireEvent.change(screen.getByRole('textbox', { name: en.name }), {
    target: { value: '  Player  ' },
  });
  fireEvent.click(screen.getByRole('checkbox', { name: en.accept }));
  fireEvent.click(screen.getByRole('button', { name: host ? en.start : en.search }));
  return fixtures.controllers.at(-1)!;
}
function hostRoom() {
  const controller = begin();
  act(() => controller.establish());
  fireEvent.click(screen.getByRole('button', { name: en.approve }));
  act(() => controller.flush());
  return controller;
}

describe('Nearby Play user flows', () => {
  it('opens home and local history without constructing a connection or starting radios', async () => {
    fixtures.saved = [savedGathering()];
    const exit = vi.fn();
    render(<NearbyRoot onExit={exit} />);
    expect(fixtures.controllers).toHaveLength(0);
    expect(fixtures.load).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: en.history }));
    fireEvent.click(await screen.findByRole('button', { name: /Saved host · Saved guest/ }));
    expect(screen.getByText('Saved locally')).toBeInTheDocument();
    expect(screen.getByText(en.historyReadOnly)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(fixtures.controllers).toHaveLength(0);
    expect(fixtures.radio.start).not.toHaveBeenCalled();
    expect(fixtures.radio.connect).not.toHaveBeenCalled();
    expect(fixtures.radio.send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: en.back }));
    fireEvent.click(screen.getByRole('button', { name: en.back }));
    fireEvent.click(screen.getByRole('button', { name: en.back }));
    expect(exit).toHaveBeenCalledOnce();
  });

  it.each([true, false])(
    'requires a valid name and conduct consent before %s host setup starts',
    (host) => {
      render(<NearbyRoot onExit={() => {}} />);
      fireEvent.click(screen.getByRole('button', { name: host ? en.create : en.join }));
      const start = screen.getByRole('button', { name: host ? en.start : en.search });
      expect(start).toBeDisabled();
      expect(screen.getAllByRole('textbox')).toHaveLength(1);
      expect(screen.queryByRole('textbox', { name: en.message })).not.toBeInTheDocument();
      fireEvent.change(screen.getByRole('textbox', { name: en.name }), {
        target: { value: 'Player' },
      });
      expect(start).toBeDisabled();
      fireEvent.click(screen.getByRole('checkbox', { name: en.accept }));
      fireEvent.change(screen.getByRole('textbox', { name: en.name }), {
        target: { value: 'x'.repeat(25) },
      });
      expect(start).toBeDisabled();
      expect(fixtures.controllers).toHaveLength(0);
      fireEvent.change(screen.getByRole('textbox', { name: en.name }), {
        target: { value: '  Player  ' },
      });
      fireEvent.click(start);
      expect(fixtures.controllers).toHaveLength(1);
      expect(fixtures.controllers[0]?.setup).toMatchObject({
        host,
        name: 'Player',
        transport: 'ble',
      });
      expect(fixtures.controllers[0]?.start).toHaveBeenCalledOnce();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    },
  );

  it('opens game preparation after approval and keeps chat an optional panel', () => {
    render(<NearbyRoot onExit={() => {}} />);
    const controller = begin();
    act(() => controller.establish());
    expect(screen.getByRole('heading', { name: 'Guest wants to join' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: en.message })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.approve }));
    expect(screen.getByRole('button', { name: en.approve })).toBeDisabled();
    expect(screen.getByRole('button', { name: en.reject })).toBeDisabled();
    expect(screen.queryByRole('textbox', { name: en.message })).not.toBeInTheDocument();
    act(() => controller.flush());
    expect(screen.getByRole('button', { name: en.game })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: en.propose })).toBeEnabled();
    expect(screen.queryByRole('textbox', { name: en.message })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.chat }));
    fireEvent.change(screen.getByRole('textbox', { name: en.message }), {
      target: { value: 'Hello nearby' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.send }));
    expect(screen.getByText(en.sending)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.send })).toBeDisabled();
    expect(controller.session.match).toBeNull();
    act(() => controller.flush());
    expect(screen.getByText(en.delivered)).toBeInTheDocument();
    expect(controller.peer.messages[0]?.text).toBe('Hello nearby');
    expect(screen.queryByRole('button', { name: en.roll })).not.toBeInTheDocument();
  });

  it('lets a joining player choose a gathering and wait without an approval button or join comment', () => {
    render(<NearbyRoot onExit={() => {}} />);
    const controller = begin(false);
    fireEvent.click(screen.getByRole('button', { name: /F-ABC123/ }));
    expect(controller.connect).toHaveBeenCalledWith('peer-1');
    expect(screen.getByRole('heading', { name: en.awaiting })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: en.approve })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    act(() => {
      controller.peer.approve();
      controller.flush();
    });
    expect(screen.queryByRole('textbox', { name: en.message })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.propose }));
    act(() => controller.flush());
    expect(controller.peer.gameProposed).toBe(true);
    expect(screen.getByRole('button', { name: en.ready })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: en.ready }));
    act(() => {
      controller.peer.ready();
      controller.flush();
      controller.peer.act({ kind: 'roll' });
      controller.flush();
      controller.peer.act({ kind: 'score', category: 'choice' });
      controller.flush();
    });
    expect(screen.getByText('Player 0 · Host 30')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Roll/ }));
    act(() => controller.flush());
    const choice = screen.getByRole('button', { name: /^Choice: 30 if taken now; Host: 30/ });
    expect(choice.querySelector('.yt-box-points')).toHaveTextContent('30');
    expect(choice.querySelector('.yt-box-cpu')).toHaveTextContent('30');
    fireEvent.click(screen.getByRole('button', { name: /^Yacht: 50 if taken now; Host:/ }));
    act(() => controller.flush());
    expect(controller.session.match!.scores[1][11]).toBe(50);
    expect(controller.session.match!.scores[0][11]).toBeNull();
    expect(screen.getByText('Player 50 · Host 30')).toBeInTheDocument();
    expect(screen.getAllByText(en.opponent)).toHaveLength(2);
    expect(screen.queryByText('CPU')).not.toBeInTheDocument();
  });

  it('requires both Ready, preserves chat across panels and a full match, and returns to the same gathering', () => {
    render(<NearbyRoot onExit={() => {}} />);
    const controller = hostRoom();
    fireEvent.click(screen.getByRole('button', { name: en.chat }));
    fireEvent.change(screen.getByRole('textbox', { name: en.message }), {
      target: { value: 'Before the game' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.send }));
    act(() => controller.flush());
    fireEvent.click(screen.getByRole('button', { name: en.game }));
    fireEvent.click(screen.getByRole('button', { name: en.propose }));
    act(() => controller.flush());
    fireEvent.click(screen.getByRole('button', { name: en.ready }));
    expect(controller.session.match).toBeNull();
    expect(screen.getByRole('button', { name: en.waitingReady })).toBeDisabled();
    act(() => {
      controller.peer.ready();
      controller.flush();
    });
    expect(screen.getByRole('button', { name: /^Roll/ })).toBeEnabled();
    expect(screen.getByRole('group', { name: 'Dice' }).querySelectorAll('.yt-pip')).toHaveLength(
      45,
    );
    expect(
      screen.getByRole('group', { name: 'Score sheet' }).querySelectorAll('.yt-box'),
    ).toHaveLength(12);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Roll/ }));
    expect(screen.getByRole('button', { name: en.pending })).toBeDisabled();
    act(() => controller.flush());
    const revision = controller.session.match!.revision;
    fireEvent.click(screen.getByRole('button', { name: en.chat }));
    expect(screen.getByText('Before the game')).toBeInTheDocument();
    expect(controller.session.match!.revision).toBe(revision);
    fireEvent.click(screen.getByRole('button', { name: en.game }));
    act(() => {
      for (const category of CATEGORIES) {
        for (const actor of [controller.session, controller.peer]) {
          if (actor.match!.rolls === 0) {
            actor.act({ kind: 'roll' });
            controller.flush();
          }
          actor.act({ kind: 'score', category });
          controller.flush();
        }
      }
    });
    expect(controller.session.matchComplete).toBe(true);
    expect(screen.getByText(en.draw)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.chat }));
    expect(screen.getByText('Before the game')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: en.message })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.game }));
    fireEvent.click(screen.getByRole('button', { name: en.rematch }));
    act(() => controller.flush());
    fireEvent.click(screen.getByRole('button', { name: en.ready }));
    expect(controller.session.match!.round).toBe(1);
    act(() => {
      controller.peer.ready();
      controller.flush();
    });
    expect(controller.session.match!.round).toBe(2);
    expect(controller.session.match!.revision).toBe(0);
    expect(controller.session.messages[0]?.text).toBe('Before the game');
  });

  it('confirms leaving, supports cancellation, and leaves local history intact', async () => {
    fixtures.saved = [savedGathering()];
    const before = structuredClone(fixtures.saved);
    render(<NearbyRoot onExit={() => {}} />);
    const controller = hostRoom();
    fireEvent.click(screen.getByRole('button', { name: en.dissolve }));
    const dialog = screen.getByRole('alertdialog', { name: en.leaveTitle });
    expect(within(dialog).getByText(en.leaveBody)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: en.cancel }));
    expect(controller.stop).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: en.propose })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: en.dissolve }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: en.leave }),
    );
    await screen.findByRole('heading', { name: en.ended });
    expect(controller.stop).toHaveBeenCalledOnce();
    expect(fixtures.clear).not.toHaveBeenCalled();
    expect(fixtures.remove).not.toHaveBeenCalled();
    expect(fixtures.saved).toEqual(before);
    fireEvent.click(screen.getByRole('button', { name: en.retry }));
    fireEvent.click(screen.getByRole('button', { name: en.history }));
    expect(
      await screen.findByRole('button', { name: /Saved host · Saved guest/ }),
    ).toBeInTheDocument();
  });

  it('retains the shared Yacht board and chat during reconnection, then resumes the same turn', () => {
    render(<NearbyRoot onExit={() => {}} />);
    const controller = hostRoom();
    act(() => {
      controller.peer.sendChat('Still here');
      controller.flush();
      controller.session.proposeGame();
      controller.flush();
      controller.session.ready();
      controller.peer.ready();
      controller.flush();
    });
    fireEvent.click(screen.getByRole('button', { name: /^Roll/ }));
    act(() => controller.flush());
    const firstDie = screen.getByRole('button', { name: 'Die 1: 6' });
    fireEvent.click(firstDie);
    act(() => controller.flush());
    expect(firstDie).toHaveAccessibleName('Die 1: 6, held');
    const before = structuredClone(controller.session.match);
    act(() => controller.session.suspend());
    expect(screen.getAllByText(en.reconnecting).length).toBeGreaterThan(0);
    for (const button of within(screen.getByRole('group', { name: 'Dice' })).getAllByRole('button'))
      expect(button).toBeDisabled();
    for (const button of within(screen.getByRole('group', { name: 'Score sheet' })).getAllByRole(
      'button',
    ))
      expect(button).toBeDisabled();
    fireEvent.keyDown(window, { key: 'r' });
    fireEvent.click(firstDie);
    expect(controller.session.match).toEqual(before);
    fireEvent.click(screen.getByRole('button', { name: en.chat }));
    expect(screen.getByText('Still here')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: en.message })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: en.game }));
    expect(screen.getByRole('button', { name: 'Die 1: 6, held' })).toBeDisabled();
    act(() => controller.session.resume());
    expect(screen.queryByText(en.reconnecting)).not.toBeInTheDocument();
    expect(controller.session.match).toEqual(before);
    expect(screen.getByRole('button', { name: /^Roll/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /^Choice: 30 if taken now; Guest:/ }));
    act(() => controller.flush());
    expect(controller.session.match!.scores[0][10]).toBe(30);
    expect(controller.peer.match!.scores[0][10]).toBe(30);
    expect(screen.getByRole('button', { name: /^Choice: scored 30; Guest:/ })).toBeDisabled();
    expect(screen.queryByText('CPU')).not.toBeInTheDocument();
    expect(controller.stop).not.toHaveBeenCalled();
  });

  it('deletes only the selected local history after warning that the peer copy remains', async () => {
    fixtures.saved = [
      savedGathering(),
      { ...savedGathering(), id: 'f'.repeat(32), names: ['Other', 'Friend'] },
    ];
    render(<NearbyRoot onExit={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: en.history }));
    fireEvent.click(await screen.findByRole('button', { name: /Saved host · Saved guest/ }));
    fireEvent.click(screen.getByRole('button', { name: en.delete }));
    expect(within(screen.getByRole('alertdialog')).getByText(en.deleteBody)).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: en.cancel }),
    );
    expect(fixtures.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: en.delete }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: en.delete }),
    );
    expect(fixtures.remove).toHaveBeenCalledExactlyOnceWith('e'.repeat(32));
    expect(await screen.findByRole('button', { name: /Other · Friend/ })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Saved host · Saved guest/ }),
    ).not.toBeInTheDocument();
    expect(fixtures.saved).toHaveLength(1);
    expect(fixtures.clear).not.toHaveBeenCalled();
    expect(fixtures.controllers).toHaveLength(0);
    expect(fixtures.radio.send).not.toHaveBeenCalled();
  });

  it('shows a failed local deletion without hiding or claiming to delete the saved history', async () => {
    fixtures.saved = [savedGathering()];
    fixtures.remove.mockRejectedValueOnce(new Error('Device storage unavailable'));
    render(<NearbyRoot onExit={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: en.history }));
    fireEvent.click(await screen.findByRole('button', { name: /Saved host · Saved guest/ }));
    fireEvent.click(screen.getByRole('button', { name: en.delete }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: en.delete }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(en.storageError);
    expect(screen.getByText('Saved locally')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.delete })).toBeEnabled();
    expect(fixtures.saved).toEqual([savedGathering()]);
    expect(fixtures.clear).not.toHaveBeenCalled();
    expect(fixtures.controllers).toHaveLength(0);
  });
});
