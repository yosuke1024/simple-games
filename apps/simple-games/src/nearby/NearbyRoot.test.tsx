import type { ReactElement } from 'react';
import type { Match } from './yacht';
import type { GameAdapter } from './gameTypes';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { Setup } from './controller';
import type { Gathering } from './history';
import type { Session, Wire } from './session';
import { CATEGORIES } from './yacht';
import { en } from './i18n/en';
import { NEARBY_GAME_CODES } from '../app/nearbyGameIds';
import { GAME_TITLES } from './games';
import type { NearbyGameId } from './gameTypes';
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
  block: Mock<() => Promise<void>>;
  establish: () => void;
  flush: () => void;
}

const fixtures = vi.hoisted(() => ({
  controllers: [] as FixtureController[],
  saved: [] as Gathering[],
  load: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
  block: vi.fn(),
  native: false,
  peerChatEnabled: false,
  addListener: vi.fn(),
  radio: { start: vi.fn(), connect: vi.fn(), send: vi.fn(), stop: vi.fn() },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => fixtures.native },
  registerPlugin: () => fixtures.radio,
}));
vi.mock('@capacitor/app', () => ({ App: { addListener: fixtures.addListener } }));
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
vi.mock('./history', async () => ({
  ...(await vi.importActual<typeof import('./history')>('./history')),
  loadHistory: fixtures.load,
  deleteGathering: fixtures.remove,
  clearHistory: fixtures.clear,
  blockIdentity: fixtures.block,
}));

// Native lifecycle and persistence have their own tests. This seam exposes
// asynchronous delivery explicitly while retaining the real admission/chat/game
// protocol, so UI tests cannot bypass mutual Ready by assigning a fake match.
vi.mock('./controller', async () => {
  const { Session } = await import('./session');
  class FakeController {
    state = 'idle';
    reason = 'ended';
    peers: Array<{ id: string; name: string; roomName: string; gameId: NearbyGameId }> = [];
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
      _plugin: unknown,
      adapter: GameAdapter,
    ) {
      this.peers = [
        { id: 'peer-1', name: 'P-811234', roomName: 'Friday games', gameId: setup.gameId },
      ];
      this.session = new Session({
        adapter,
        host: setup.host,
        chatEnabled: setup.chatEnabled,
        name: setup.name,
        roomName: setup.host ? setup.roomName : undefined,
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
              roomName: this.session.roomName,
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
        adapter,
        host: !setup.host,
        chatEnabled: fixtures.peerChatEnabled,
        name: setup.host ? 'Guest' : 'Host',
        roomName: setup.host ? undefined : 'Friday games',
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
  fixtures.native = false;
  fixtures.peerChatEnabled = false;
  fixtures.block.mockResolvedValue(undefined);
  fixtures.saved = [];
  vi.clearAllMocks();
  fixtures.addListener.mockResolvedValue({ remove: vi.fn(async () => {}) });
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
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(document, 'visibilityState');
});

async function renderNearby(element: ReactElement) {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(element);
  });
  await screen.findByRole('button', { name: en.create });
  return view;
}

function begin(host = true, chatEnabled = false) {
  fireEvent.click(screen.getByRole('button', { name: host ? en.create : en.join }));
  fireEvent.change(screen.getByRole('textbox', { name: en.name }), {
    target: { value: '  Player  ' },
  });
  if (host && chatEnabled) fireEvent.click(screen.getByRole('checkbox', { name: en.useChat }));
  fireEvent.click(screen.getByRole('checkbox', { name: en.accept }));
  fireEvent.click(screen.getByRole('button', { name: host ? en.start : en.search }));
  return fixtures.controllers.at(-1)!;
}
function hostRoom(chatEnabled = false) {
  const controller = begin(true, chatEnabled);
  act(() => controller.establish());
  fireEvent.click(screen.getByRole('button', { name: en.approve }));
  act(() => controller.flush());
  act(() => controller.flush());
  return controller;
}

describe('Nearby Play user flows', () => {
  it('hides filtered legacy text without rewriting it, but previews the specifically reported original', async () => {
    const offensive = 'send nudes';
    fixtures.saved = [
      {
        ...savedGathering(),
        roomName: offensive,
        messages: [
          { id: 'old-peer', sender: 'peer', text: offensive, at: 1500, status: 'delivered' },
        ],
      },
    ];
    await renderNearby(<NearbyRoot gameId="yacht" onExit={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: en.history }));
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(en.contentHidden) }));
    expect(screen.queryByText(offensive)).not.toBeInTheDocument();
    expect(screen.getAllByText(en.contentHidden)).toHaveLength(2);
    fireEvent.click(within(screen.getByRole('article')).getByRole('button', { name: en.report }));
    expect(
      (screen.getByRole('textbox', { name: en.reportContent }) as HTMLTextAreaElement).value,
    ).toContain(offensive);
    expect(fixtures.saved[0]!.roomName).toBe(offensive);
    expect(fixtures.saved[0]!.messages[0]!.text).toBe(offensive);
    expect(fixtures.remove).not.toHaveBeenCalled();
  });

  it('can report and block an unapproved peer without admitting them', async () => {
    await renderNearby(<NearbyRoot gameId="yacht" onExit={() => {}} />);
    const controller = begin();
    act(() => controller.establish());
    expect(controller.session.paired).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: en.report }));
    expect(
      (screen.getByRole('textbox', { name: en.reportContent }) as HTMLTextAreaElement).value,
    ).toContain('Guest');
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: en.block }));
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: en.block }),
      );
    });
    expect(controller.block).toHaveBeenCalledOnce();
    expect(controller.session.paired).toBe(false);
    expect(controller.state).toBe('ended');
  });

  it('blocks a saved peer after leaving, reports only the selected message, and keeps legacy history readable', async () => {
    fixtures.saved = [
      {
        ...savedGathering(),
        peerIdentity: 'd'.repeat(32),
        messages: [
          {
            id: 'peer-message',
            sender: 'peer',
            text: 'Selected peer message',
            at: 1700,
            status: 'delivered',
          },
          {
            id: 'private-message',
            sender: 'self',
            text: 'Unselected private text',
            at: 1800,
            status: 'delivered',
          },
        ],
      },
    ];
    await renderNearby(<NearbyRoot gameId="yacht" onExit={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: en.history }));
    fireEvent.click(await screen.findByRole('button', { name: /Saved host/ }));
    fireEvent.click(
      within(screen.getByText('Selected peer message').closest('article')!).getByRole('button', {
        name: en.report,
      }),
    );
    const evidence = (
      screen.getByRole('textbox', { name: en.reportContent }) as HTMLTextAreaElement
    ).value;
    expect(evidence).toContain('Selected peer message');
    expect(evidence).not.toContain('Unselected private text');
    expect(evidence).not.toContain('d'.repeat(32));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: en.blockPlayer }));
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: en.blockPlayer }),
      );
    });
    expect(fixtures.block).toHaveBeenCalledExactlyOnceWith('d'.repeat(32));
    expect(screen.getByRole('status')).toHaveTextContent(en.blocked);
    expect(fixtures.controllers).toHaveLength(0);
    expect(fixtures.radio.start).not.toHaveBeenCalled();
    expect(fixtures.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: en.back }));
    fixtures.saved = [savedGathering()];
    fireEvent.click(screen.getByRole('button', { name: en.back }));
    fireEvent.click(screen.getByRole('button', { name: en.history }));
    fireEvent.click(await screen.findByRole('button', { name: /Saved host/ }));
    expect(screen.queryByRole('button', { name: en.blockPlayer })).not.toBeInTheDocument();
    expect(screen.getByText('Saved locally')).toBeVisible();
  });

  it('keeps the history and block action available if saving a local block fails', async () => {
    fixtures.saved = [{ ...savedGathering(), peerIdentity: 'd'.repeat(32) }];
    fixtures.block.mockRejectedValueOnce(new Error('disk full'));
    await renderNearby(<NearbyRoot gameId="yacht" onExit={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: en.history }));
    fireEvent.click(await screen.findByRole('button', { name: /Saved host/ }));
    fireEvent.click(screen.getByRole('button', { name: en.blockPlayer }));
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: en.blockPlayer }),
      );
    });
    expect(screen.getByRole('alert')).toHaveTextContent(en.storageError);
    expect(screen.queryByText(en.blocked)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.blockPlayer })).toBeEnabled();
    expect(screen.getByText('Saved locally')).toBeVisible();
  });

  it('generates an editable gathering name and keeps it separate from player names', async () => {
    await renderNearby(<NearbyRoot gameId="yacht" onExit={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: en.create }));
    const roomName = screen.getByRole('textbox', { name: en.roomName });
    expect((roomName as HTMLInputElement).value).toMatch(/^Yacht \d{4}$/);
    expect(screen.getAllByRole('radio')).toHaveLength(2); // Transport only.
    fireEvent.change(screen.getByRole('textbox', { name: en.name }), {
      target: { value: 'Yosuke' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: en.accept }));
    for (const invalid of ['', 'x'.repeat(25)]) {
      fireEvent.change(roomName, { target: { value: invalid } });
      expect(screen.getByRole('button', { name: en.start })).toBeDisabled();
    }
    fireEvent.change(roomName, { target: { value: '  Friday games  ' } });
    fireEvent.click(screen.getByRole('button', { name: en.start }));
    const controller = fixtures.controllers.at(-1)!;
    expect(controller.setup).toMatchObject({ name: 'Yosuke', roomName: 'Friday games' });
    expect(screen.getByRole('heading', { name: 'Friday games' })).toBeVisible();
    act(() => controller.establish());
    fireEvent.click(screen.getByRole('button', { name: en.approve }));
    act(() => controller.flush());
    expect(controller.session.names).toEqual(['Yosuke', 'Guest']);
    expect(screen.getByRole('heading', { name: 'Friday games' })).toBeVisible();
  });

  it.each([true, false])('prefills a locally saved display name in host=%s setup', async (host) => {
    fixtures.load.mockResolvedValue({ displayName: 'Remembered player', gatherings: [] });
    await renderNearby(<NearbyRoot gameId="nim" onExit={() => {}} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: host ? en.create : en.join }));
    });
    expect(screen.getByRole('textbox', { name: en.name })).toHaveValue('Remembered player');
    expect(fixtures.controllers).toHaveLength(0);
  });

  it('does not overwrite an edited or cleared display name when storage finishes loading', async () => {
    let finish!: (value: unknown) => void;
    fixtures.load.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await renderNearby(<NearbyRoot gameId="yacht" onExit={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: en.create }));
    const name = screen.getByRole('textbox', { name: en.name });
    fireEvent.change(name, { target: { value: 'New player' } });
    fireEvent.change(name, { target: { value: '' } });
    await act(async () => {
      finish({ displayName: 'Old player' });
    });
    expect(name).toHaveValue('');
  });

  it('shows gathering names in new histories and keeps personal names in the transcript', async () => {
    fixtures.saved = [{ ...savedGathering(), roomName: 'Friday games' }];
    await renderNearby(<NearbyRoot gameId="yacht" onExit={() => {}} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.history }));
    });
    fireEvent.click(screen.getByRole('button', { name: /Friday games/ }));
    expect(screen.getByRole('heading', { name: 'Friday games' })).toBeVisible();
    expect(screen.getByText('Saved host · Saved guest')).toBeVisible();
    expect(screen.getByText('Saved host', { selector: 'strong' })).toBeVisible();
  });

  it.each((Object.keys(NEARBY_GAME_CODES) as NearbyGameId[]).filter((id) => id !== 'ludo'))(
    'prepares and starts %s through its real game adapter and board',
    async (gameId) => {
      await renderNearby(<NearbyRoot gameId={gameId} onExit={() => {}} />);
      expect(screen.getByRole('heading', { name: GAME_TITLES[gameId] })).toBeInTheDocument();
      const c = hostRoom(false);
      expect(c.session.gameId).toBe(gameId);
      expect(c.peer.gameId).toBe(gameId);
      expect(c.session.match).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: en.ready }));
      act(() => {
        c.flush();
        c.peer.ready();
        c.flush();
      });
      expect(c.session.match?.gameId).toBe(gameId);
      expect(c.session.adapter.isView(c.session.match!.state)).toBe(true);
      expect(c.peer.adapter.isView(c.peer.match!.state)).toBe(true);
      expect(c.session.result).toEqual(c.peer.result);
      expect(screen.getByRole('region', { name: GAME_TITLES[gameId] })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: en.chat })).not.toBeInTheDocument();
    },
  );

  it('opens home and local history without constructing a connection or starting radios', async () => {
    fixtures.saved = [savedGathering()];
    const exit = vi.fn();
    await renderNearby(<NearbyRoot gameId="yacht" onExit={exit} />);
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
    async (host) => {
      await renderNearby(<NearbyRoot gameId="yacht" onExit={() => {}} />);
      fireEvent.click(screen.getByRole('button', { name: host ? en.create : en.join }));
      const start = screen.getByRole('button', { name: host ? en.start : en.search });
      expect(start).toBeDisabled();
      expect(screen.getAllByRole('textbox')).toHaveLength(host ? 2 : 1);
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

  it('defaults hosting to no chat, keeps that policy fixed, and still prepares and plays Yacht', async () => {
    await renderNearby(<NearbyRoot gameId="yacht" onExit={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: en.create }));
    const toggle = screen.getByRole('checkbox', { name: en.useChat });
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveAccessibleDescription(en.chatSettingHint);
    fireEvent.change(screen.getByRole('textbox', { name: en.name }), {
      target: { value: 'Player' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: en.accept }));
    fireEvent.click(screen.getByRole('button', { name: en.start }));
    const controller = fixtures.controllers.at(-1)!;
    expect(controller.setup.chatEnabled).toBe(false);
    expect(screen.queryByRole('checkbox', { name: en.useChat })).not.toBeInTheDocument();

    act(() => controller.establish());
    expect(screen.getByText(en.chatOff)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: en.ready })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.approve }));
    act(() => controller.flush());
    act(() => controller.flush());
    expect(screen.getByText(en.chatOff)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.ready })).toBeEnabled();
    expect(screen.queryByRole('button', { name: en.chat })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: en.unreadChat })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: en.message })).not.toBeInTheDocument();
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(en.room));
    expect(screen.queryByRole('button', { name: en.hideChat })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: en.showChat })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.block })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.dissolve })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: en.ready }));
    act(() => {
      controller.peer.ready();
      controller.flush();
    });
    fireEvent.click(screen.getByRole('button', { name: /^Roll/ }));
    act(() => controller.flush());
    expect(controller.session.match!.revision).toBe(1);
    expect(controller.peer.match).toEqual(controller.session.match);
    expect(screen.queryByRole('button', { name: en.chat })).not.toBeInTheDocument();
  });

  it.each([false, true])(
    'shows the host’s chat policy before guest Ready (chat=%s)',
    async (chatEnabled) => {
      fixtures.peerChatEnabled = chatEnabled;
      await renderNearby(<NearbyRoot gameId="yacht" onExit={() => {}} />);
      fireEvent.click(screen.getByRole('button', { name: en.join }));
      expect(screen.queryByRole('checkbox', { name: en.useChat })).not.toBeInTheDocument();
      expect(screen.queryByText(en.chatSettingHint)).not.toBeInTheDocument();
      fireEvent.change(screen.getByRole('textbox', { name: en.name }), {
        target: { value: 'Guest' },
      });
      fireEvent.click(screen.getByRole('checkbox', { name: en.accept }));
      fireEvent.click(screen.getByRole('button', { name: en.search }));
      expect(screen.queryByText(en.chatOn)).not.toBeInTheDocument();
      expect(screen.queryByText(en.chatOff)).not.toBeInTheDocument();
      const controller = fixtures.controllers.at(-1)!;
      fireEvent.click(screen.getByRole('button', { name: /Friday games/ }));
      expect(screen.getByText(chatEnabled ? en.chatOn : en.chatOff)).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: en.useChat })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: en.ready })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: en.chat })).not.toBeInTheDocument();

      act(() => {
        controller.peer.approve();
        controller.flush();
      });
      act(() => controller.flush());
      expect(controller.session.chatEnabled).toBe(chatEnabled);
      expect(screen.getByText(chatEnabled ? en.chatOn : en.chatOff)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: en.ready })).toBeEnabled();
      if (chatEnabled) expect(screen.getByRole('button', { name: en.chat })).toBeInTheDocument();
      else expect(screen.queryByRole('button', { name: en.chat })).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: en.message })).not.toBeInTheDocument();
    },
  );

  it('opens game preparation after approval and keeps chat an optional panel', async () => {
    await renderNearby(<NearbyRoot gameId="yacht" onExit={() => {}} />);
    const controller = begin(true, true);
    expect(controller.setup.chatEnabled).toBe(true);
    act(() => controller.establish());
    expect(screen.getByText(en.chatOn)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: en.useChat })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Guest wants to join' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: en.message })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.approve }));
    expect(screen.getByRole('button', { name: en.approve })).toBeDisabled();
    expect(screen.getByRole('button', { name: en.reject })).toBeDisabled();
    expect(screen.queryByRole('textbox', { name: en.message })).not.toBeInTheDocument();
    act(() => controller.flush());
    expect(screen.getByRole('button', { name: en.ready })).toBeEnabled();
    expect(screen.queryByRole('button', { name: en.propose })).not.toBeInTheDocument();
    expect(controller.session.localReady).toBe(false);
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

  it('lets a joining player choose a gathering and wait without an approval button or join comment', async () => {
    await renderNearby(<NearbyRoot gameId="yacht" onExit={() => {}} />);
    const controller = begin(false);
    fireEvent.click(screen.getByRole('button', { name: /Friday games/ }));
    expect(controller.connect).toHaveBeenCalledWith('peer-1');
    expect(screen.getByRole('heading', { name: en.awaiting })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: en.approve })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    act(() => {
      controller.peer.approve();
      controller.flush();
    });
    expect(screen.queryByRole('textbox', { name: en.message })).not.toBeInTheDocument();
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
    expect((controller.session.match!.state as Match).scores[1][11]).toBe(50);
    expect((controller.session.match!.state as Match).scores[0][11]).toBeNull();
    expect(screen.getByText('Player 50 · Host 30')).toBeInTheDocument();
    expect(screen.getAllByText(en.opponent)).toHaveLength(2);
    expect(screen.queryByText('CPU')).not.toBeInTheDocument();
  });

  it('requires both Ready, preserves chat across panels and a full match, and returns to the same gathering', async () => {
    await renderNearby(<NearbyRoot gameId="yacht" onExit={() => {}} />);
    const controller = hostRoom(true);
    fireEvent.click(screen.getByRole('button', { name: en.chat }));
    fireEvent.change(screen.getByRole('textbox', { name: en.message }), {
      target: { value: 'Before the game' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.send }));
    act(() => controller.flush());
    fireEvent.click(screen.getByRole('button', { name: en.closeChat }));
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
    fireEvent.click(screen.getByRole('button', { name: en.closeChat }));
    act(() => {
      for (const category of CATEGORIES) {
        for (const actor of [controller.session, controller.peer]) {
          if ((actor.match!.state as Match).rolls === 0) {
            actor.act({ kind: 'roll' });
            controller.flush();
          }
          actor.act({ kind: 'score', category });
          controller.flush();
        }
      }
    });
    expect(controller.session.matchComplete).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent(en.draw);
    fireEvent.click(screen.getByRole('button', { name: en.chat }));
    expect(screen.getByText('Before the game')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: en.message })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.closeChat }));
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
    await renderNearby(<NearbyRoot gameId="yacht" onExit={() => {}} />);
    const controller = hostRoom();
    fireEvent.click(screen.getByRole('button', { name: en.dissolve }));
    const dialog = screen.getByRole('alertdialog', { name: en.leaveTitle });
    expect(within(dialog).getByText(en.leaveBody)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: en.cancel }));
    expect(controller.stop).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: en.ready })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: en.dissolve }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: en.leave }),
    );
    await screen.findByRole('heading', { name: en.ended });
    expect(controller.stop).toHaveBeenCalledOnce();
    expect(fixtures.clear).not.toHaveBeenCalled();
    expect(fixtures.remove).not.toHaveBeenCalled();
    expect(fixtures.saved).toEqual(before);
    fireEvent.click(screen.getByRole('button', { name: en.retry.replace('{game}', 'Yacht') }));
    fireEvent.click(screen.getByRole('button', { name: en.history }));
    expect(
      await screen.findByRole('button', { name: /Saved host · Saved guest/ }),
    ).toBeInTheDocument();
  });

  it('retains the shared Yacht board and chat during reconnection, then resumes the same turn', async () => {
    await renderNearby(<NearbyRoot gameId="yacht" onExit={() => {}} />);
    const controller = hostRoom(true);
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
    fireEvent.click(screen.getByRole('button', { name: en.unreadChat }));
    expect(screen.getByText('Still here')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: en.message })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: en.closeChat }));
    expect(screen.getByRole('button', { name: 'Die 1: 6, held' })).toBeDisabled();
    act(() => controller.session.resume());
    expect(screen.queryByText(en.reconnecting)).not.toBeInTheDocument();
    expect(controller.session.match).toEqual(before);
    expect(screen.getByRole('button', { name: /^Roll/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /^Choice: 30 if taken now; Guest:/ }));
    act(() => controller.flush());
    expect((controller.session.match!.state as Match).scores[0][10]).toBe(30);
    expect((controller.peer.match!.state as Match).scores[0][10]).toBe(30);
    expect(screen.getByRole('button', { name: /^Choice: scored 30; Guest:/ })).toBeDisabled();
    expect(screen.queryByText('CPU')).not.toBeInTheDocument();
    expect(controller.stop).not.toHaveBeenCalled();
  });

  it('keeps a live game when leaving its screen and ignores hidden keyboard and native back events', async () => {
    fixtures.native = true;
    const exit = vi.fn();
    const activeChanged = vi.fn();
    const registerStop = vi.fn<(stop: (() => Promise<void>) | null) => void>();
    const view = await renderNearby(
      <NearbyRoot
        gameId="yacht"
        onExit={exit}
        onActiveChange={activeChanged}
        onRegisterStop={registerStop}
      />,
    );
    const controller = hostRoom(true);
    act(() => {
      controller.session.ready();
      controller.peer.ready();
      controller.flush();
    });
    fireEvent.click(screen.getByRole('button', { name: /^Roll/ }));
    act(() => controller.flush());
    const before = structuredClone(controller.session.match);
    const oldBack = fixtures.addListener.mock.calls[0]![1] as () => void;
    fireEvent.click(screen.getByRole('button', { name: en.chat }));
    act(oldBack);
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    expect(exit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: en.chat }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    expect(exit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: en.chat }));
    fireEvent.click(screen.getByRole('button', { name: en.back }));
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    expect(exit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: en.back }));
    expect(exit).toHaveBeenCalledOnce();
    expect(controller.stop).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    view.rerender(
      <NearbyRoot
        gameId="yacht"
        onExit={exit}
        visible={false}
        onActiveChange={activeChanged}
        onRegisterStop={registerStop}
      />,
    );
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(window, { key: 'r' });
    fireEvent.keyDown(window, { key: '1' });
    act(oldBack);
    expect(exit).toHaveBeenCalledOnce();
    expect(controller.session.match).toEqual(before);
    expect(controller.stop).not.toHaveBeenCalled();
    expect(activeChanged.mock.calls.map(([active]) => active)).toEqual([false, true]);
    expect(registerStop).toHaveBeenCalledTimes(1);
    view.rerender(
      <NearbyRoot
        gameId="yacht"
        onExit={exit}
        visible
        onActiveChange={activeChanged}
        onRegisterStop={registerStop}
      />,
    );
    expect(screen.getByRole('button', { name: /^Roll/ })).toBeEnabled();
    expect(controller.session.match).toEqual(before);
    expect(fixtures.controllers).toHaveLength(1);
    // The app can await this before clearing local history, even while the view is retained.
    const stop = registerStop.mock.calls[0]![0]!;
    await act(async () => {
      await stop();
    });
    expect(controller.stop).toHaveBeenCalledOnce();
    expect(activeChanged.mock.calls.map(([active]) => active)).toEqual([false, true, false]);
    view.unmount();
    expect(registerStop).toHaveBeenLastCalledWith(null);
    expect(activeChanged).toHaveBeenLastCalledWith(false);
  });

  it('shows a quiet unread mark without replacing the game and does not read chat while hidden', async () => {
    const view = await renderNearby(<NearbyRoot gameId="yacht" onExit={() => {}} />);
    const controller = hostRoom(true);
    act(() => {
      controller.peer.sendChat('First message');
      controller.flush();
    });
    expect(screen.getByRole('button', { name: en.ready })).toBeInTheDocument();
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    const chat = screen.getByRole('button', { name: en.unreadChat });
    expect(chat).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(chat);
    expect(screen.getByRole('heading', { name: en.chat })).toHaveFocus();
    expect(screen.getByText('First message')).toBeInTheDocument();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    act(() => {
      controller.peer.sendChat('In background');
      controller.flush();
    });
    expect(screen.getByRole('button', { name: en.closeChat })).toHaveAttribute(
      'data-unread',
      'true',
    );
    Reflect.deleteProperty(document, 'visibilityState');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByRole('button', { name: en.closeChat })).toHaveAttribute(
      'data-unread',
      'false',
    );
    view.rerender(<NearbyRoot gameId="yacht" onExit={() => {}} visible={false} />);
    act(() => {
      controller.peer.sendChat('While away');
      controller.flush();
    });
    // Hidden chat remains unread, even though its DOM is retained.
    const hiddenToggle = view.container.querySelector('.nearby-chat-toggle')!;
    expect(hiddenToggle).toHaveAttribute('data-unread', 'true');
    expect(controller.stop).not.toHaveBeenCalled();
    view.rerender(<NearbyRoot gameId="yacht" onExit={() => {}} visible />);
    expect(screen.getByText('While away')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.closeChat })).toHaveAttribute(
      'data-unread',
      'false',
    );
    fireEvent.click(screen.getByRole('button', { name: en.closeChat }));
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.chat })).toHaveFocus();
    expect(screen.getByRole('button', { name: en.ready })).toBeEnabled();
    act(() => {
      controller.peer.sendChat('Another message');
      controller.flush();
    });
    expect(screen.getByRole('button', { name: en.unreadChat })).toBeInTheDocument();
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
  });

  it('reports discovery as active without repeated notifications when callbacks change, and clears on unmount', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const view = await renderNearby(
      <NearbyRoot gameId="yacht" onExit={() => {}} onActiveChange={first} />,
    );
    const controller = begin();
    expect(first.mock.calls.map(([active]) => active)).toEqual([false, true]);
    view.rerender(<NearbyRoot gameId="yacht" onExit={() => {}} onActiveChange={second} />);
    expect(second).not.toHaveBeenCalled();
    view.unmount();
    expect(second).toHaveBeenCalledExactlyOnceWith(false);
    expect(controller.stop).toHaveBeenCalledOnce();
  });

  it('blocks Back during a delayed clear and removes the saved name from the next setup', async () => {
    let finish!: () => void;
    fixtures.clear.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    fixtures.load.mockResolvedValue({ displayName: 'Old player', gatherings: [] });
    await renderNearby(<NearbyRoot gameId="yacht" onExit={() => {}} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.create }));
    });
    expect(screen.getByRole('textbox', { name: en.name })).toHaveValue('Old player');
    fireEvent.click(screen.getByRole('button', { name: en.back }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.history }));
    });
    fireEvent.click(screen.getByRole('button', { name: en.clear }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: en.clear }),
    );
    expect(screen.getByRole('button', { name: en.back })).toBeDisabled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('heading', { name: en.history })).toBeInTheDocument();
    fixtures.load.mockResolvedValue({ gatherings: [] });
    await act(async () => {
      finish();
    });
    fireEvent.click(screen.getByRole('button', { name: en.back }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.create }));
    });
    expect(screen.getByRole('textbox', { name: en.name })).toHaveValue('');
  });

  it('deletes only the selected local history after warning that the peer copy remains', async () => {
    fixtures.saved = [
      savedGathering(),
      { ...savedGathering(), id: 'f'.repeat(32), names: ['Other', 'Friend'] },
    ];
    await renderNearby(<NearbyRoot gameId="yacht" onExit={() => {}} />);
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
    await renderNearby(<NearbyRoot gameId="yacht" onExit={() => {}} />);
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
