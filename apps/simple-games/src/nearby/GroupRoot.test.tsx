import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { SettingsProvider } from '../state/SettingsContext';
import { settingsSchema } from '../storage/schemas';
import type { GroupSetup } from './groupController';
import type { Control, GroupSession, GroupSnapshot } from './groupSession';
import type { SavedGroup } from './history';
import { nearbyText } from './i18n';
import type { NearbyMessages } from './i18n';
import GroupRoot, { type GroupSelection } from './GroupRoot';
import { createLudo } from './games/ludo';

interface FixtureController {
  setup: GroupSetup;
  status: string;
  reason: string;
  hostSession: GroupSession | null;
  snapshot: GroupSnapshot | null;
  participants: Map<string, { name: string; identity: string }>;
  block: Mock;
  start: Mock;
  stop: Mock;
  control: Mock;
  approve: Mock;
  ready: Mock;
  startRound: Mock;
  join: Mock;
  act: Mock;
  notify: () => void;
  receiveSnapshot: (snapshot: GroupSnapshot) => void;
}
const fixture = vi.hoisted(() => ({
  controllers: [] as FixtureController[],
  saved: [] as SavedGroup[],
  load: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
  addListener: vi.fn(),
  radio: {},
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
  registerPlugin: () => fixture.radio,
}));
vi.mock('@capacitor/app', () => ({ App: { addListener: fixture.addListener } }));
vi.mock('./history', async () => ({
  ...(await vi.importActual<typeof import('./history')>('./history')),
  loadHistory: fixture.load,
  deleteGroup: fixture.remove,
  clearHistory: fixture.clear,
}));

// Keep the real host seat/Ready/game rules and shared board while replacing radio,
// encryption, storage writes and CPU scheduling (covered by controller integration tests).
vi.mock('./groupController', async () => {
  const { GroupSession } = await import('./groupSession');
  const { createLudo, applyLudo, isLudoState, ludoCpuAction, ludoResult } =
    await import('./games/ludo');
  const game = {
    capacity: 4,
    create: () => createLudo(() => 0),
    valid: isLudoState,
    turn: (s: unknown) => (isLudoState(s) ? s.turn : -1),
    finished: (s: unknown) => isLudoState(s) && ludoResult(s) !== null,
    apply: (s: unknown, seat: number, action: unknown) =>
      isLudoState(s) ? applyLudo(s, seat, action, () => 0) : null,
    cpu: (s: unknown) => (isLudoState(s) ? ludoCpuAction(s) : null),
  };
  class FakeController {
    status = 'idle';
    reason = '';
    storageFailed = false;
    hostSession: GroupSession | null = null;
    snapshot: GroupSnapshot | null = null;
    codes = new Map<string, string>();
    participants = new Map<string, { name: string; identity: string }>();
    peers = [{ id: 'peer-ludo', name: 'P-8E1234', roomName: 'Saturday Ludo', gameId: 'ludo' }];
    constructor(
      readonly setup: GroupSetup,
      private readonly changed: () => void,
    ) {
      fixture.controllers.push(this);
    }
    start = vi.fn(async () => {
      if (this.setup.host) {
        this.hostSession = new GroupSession({
          name: this.setup.name,
          title: this.setup.roomName,
          room: 'a'.repeat(32),
          game,
          send: () => {},
          changed: () => this.notify(),
        });
        this.status = 'room';
      } else this.status = 'searching';
      this.notify();
    });
    notify = () => {
      if (this.hostSession) {
        for (const peer of this.hostSession.members.keys())
          this.hostSession.acknowledgements.set(peer, this.hostSession.revision);
        this.snapshot = this.hostSession.snapshot();
      }
      this.changed();
    };
    receiveSnapshot(snapshot: GroupSnapshot) {
      this.snapshot = structuredClone(snapshot);
      this.status = 'room';
      this.notify();
    }
    stop = vi.fn(async () => {
      this.hostSession?.end();
      this.status = 'ended';
      this.notify();
    });
    block = vi.fn(async (peer: string) => {
      if (this.hostSession) this.hostSession.disconnect(peer);
      else await this.stop();
      this.participants.delete(peer);
      this.notify();
    });
    join = vi.fn(async () => {
      this.status = 'connecting';
      this.notify();
    });
    approve = vi.fn((peer: string, seat: number) => this.hostSession?.approve(peer, seat));
    decline = vi.fn((peer: string) => this.hostSession?.reject(peer));
    control = vi.fn((seat: number, control: Control) => this.hostSession?.control(seat, control));
    ready = vi.fn(() => this.hostSession?.ready());
    startRound = vi.fn(() => this.hostSession?.start());
    act = vi.fn((action: unknown) => {
      const session = this.hostSession;
      if (session) session.act('host', session.revision, session.seats[0]!.epoch, action);
    });
    setForeground = vi.fn();
    get canAct() {
      return (
        this.status === 'room' &&
        (this.hostSession
          ? this.hostSession.canAct(0)
          : !!this.snapshot &&
            this.snapshot.seats[this.snapshot.you]?.control === 'human' &&
            this.snapshot.seats.every((s) => s.control !== 'human' || s.connected) &&
            game.turn(this.snapshot.state) === this.snapshot.you)
      );
    }
  }
  return { GroupController: FakeController };
});

const text = (key: keyof NearbyMessages, vars?: Record<string, string | number>) =>
  nearbyText('en', key, vars);
const last = () => fixture.controllers.at(-1)!;
async function mount(initial?: GroupSelection, strict = false) {
  const onExit = vi.fn();
  const onActiveChange = vi.fn();
  const props = { onExit, onActiveChange, initial, gameId: 'ludo' as const };
  let view!: ReturnType<typeof render>;
  await act(async () => {
    const element = (
      <SettingsProvider initialSettings={{ ...settingsSchema.defaultValue(), language: 'en' }}>
        <GroupRoot {...props} />
      </SettingsProvider>
    );
    view = render(strict ? <StrictMode>{element}</StrictMode> : element);
  });
  const setVisible = (visible: boolean) =>
    view.rerender(
      <SettingsProvider initialSettings={{ ...settingsSchema.defaultValue(), language: 'en' }}>
        <GroupRoot {...props} visible={visible} />
      </SettingsProvider>,
    );
  return { ...view, onExit, onActiveChange, props, setVisible };
}
async function hostRoom() {
  const view = await mount();
  fireEvent.change(screen.getByLabelText(text('name')), { target: { value: 'Host' } });
  fireEvent.change(screen.getByLabelText(text('roomName')), { target: { value: 'Saturday Ludo' } });
  fireEvent.click(screen.getByRole('checkbox', { name: text('accept') }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: text('create') }));
  });
  return view;
}
function guestSnapshot(): GroupSnapshot {
  return {
    group: 1,
    type: 'state',
    room: 'a'.repeat(32),
    title: 'Saturday Ludo',
    revision: 2,
    round: 0,
    you: 1,
    state: null,
    seats: [
      { name: 'Host', control: 'human', connected: true, ready: true, epoch: 0 },
      { name: 'Guest', control: 'human', connected: true, ready: false, epoch: 1 },
      { name: '', control: 'cpu', connected: false, ready: true, epoch: 0 },
      { name: '', control: 'cpu', connected: false, ready: true, epoch: 0 },
    ],
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  fixture.controllers.length = 0;
  fixture.saved = [];
  fixture.addListener.mockResolvedValue({ remove: vi.fn() });
  fixture.load.mockImplementation(async () => ({
    version: 1,
    identity: 'c'.repeat(32),
    blocked: [],
    gatherings: [],
    groups: structuredClone(fixture.saved),
  }));
  fixture.remove.mockImplementation(async (id: string) => {
    fixture.saved = fixture.saved.filter((g) => g.id !== id);
  });
  fixture.clear.mockImplementation(async () => {
    fixture.saved = [];
  });
});
afterEach(cleanup);

describe('Ludo group room', () => {
  it('shows four fixed seats and starts with host plus three CPUs after host Ready', async () => {
    await hostRoom();
    const cards = document.querySelectorAll('.group-seats > .nearby-card');
    expect(cards).toHaveLength(4);
    expect(screen.getAllByRole('combobox')).toHaveLength(3);
    for (let seat = 2; seat <= 4; seat++) {
      expect(screen.getByLabelText(text('groupSwitch', { seat }))).toHaveValue('cpu');
      expect(
        within(cards[seat - 1] as HTMLElement).getByText(text('groupCpuName', { seat })),
      ).toBeVisible();
    }
    expect(screen.getByRole('button', { name: text('groupStart') })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: text('ready') }));
    expect(screen.getByRole('button', { name: text('groupStart') })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: text('groupStart') }));
    expect(last().hostSession?.round).toBe(1);
    expect(document.querySelector('.group-seat-controls')).not.toHaveAttribute('open');
    expect(screen.getByLabelText(text('groupSwitch', { seat: 2 }))).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Roll the die' }));
    expect(last().act).toHaveBeenCalledWith({ kind: 'roll' });
    expect(last().snapshot?.state).toMatchObject({ turn: 1, rollIndex: 1 });
  });

  it('starts three ready humans and one CPU without requiring a fourth participant', async () => {
    await hostRoom();
    const session = last().hostSession!;
    act(() => {
      session.request('guest-a', 'Aki');
      session.approve('guest-a', 1);
      session.request('guest-b', 'Yuki');
      session.approve('guest-b', 2);
    });
    expect(session.seats.map((seat) => seat.control)).toEqual(['human', 'human', 'human', 'cpu']);
    expect(screen.getByLabelText(text('groupSwitch', { seat: 4 }))).toHaveValue('cpu');
    fireEvent.click(screen.getByRole('button', { name: text('ready') }));
    expect(screen.getByRole('button', { name: text('groupStart') })).toBeDisabled();
    act(() => {
      session.ready('guest-a');
      session.ready('guest-b');
    });
    expect(screen.getByRole('button', { name: text('groupStart') })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: text('groupStart') }));
    expect(session.round).toBe(1);
    expect(screen.getByRole('group', { name: 'Ludo board' })).toBeVisible();
    expect(session.seats[3]!.control).toBe('cpu');
  });

  it('starts only one room when the setup form is submitted twice before yielding', async () => {
    await mount();
    fireEvent.change(screen.getByLabelText(text('name')), { target: { value: 'Host' } });
    fireEvent.click(screen.getByRole('checkbox', { name: text('accept') }));
    const form = screen.getByRole('button', { name: text('create') }).closest('form')!;
    await act(async () => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });
    expect(fixture.controllers).toHaveLength(1);
    expect(last().start).toHaveBeenCalledTimes(1);
  });

  it('starts a selected room only once through the app StrictMode effect cycle', async () => {
    await mount(
      { name: 'Guest', roomName: 'Saturday Ludo', label: 'P-8E1234', transport: 'ble' },
      true,
    );
    expect(fixture.controllers).toHaveLength(1);
    expect(last().start).toHaveBeenCalledTimes(1);
    expect(last().status).toBe('searching');
  });

  it('assigns approval to the selected seat and waits for that human to be ready', async () => {
    await hostRoom();
    const session = last().hostSession!;
    act(() => {
      session.request('guest-a', 'Aki');
    });
    const request = screen
      .getByRole('heading', { name: text('request', { name: 'Aki' }) })
      .closest('section')!;
    fireEvent.click(
      within(request).getByRole('button', { name: text('groupJoinSeat', { seat: 3 }) }),
    );
    expect(last().approve).toHaveBeenCalledWith('guest-a', 2);
    expect(session.seats[2]).toMatchObject({ name: 'Aki', control: 'human', connected: true });
    fireEvent.click(screen.getByRole('button', { name: text('ready') }));
    expect(screen.getByRole('button', { name: text('groupStart') })).toBeDisabled();
    act(() => {
      session.ready('guest-a');
    });
    expect(screen.getByRole('button', { name: text('groupStart') })).toBeEnabled();
  });

  it('preserves the board when a connected human becomes CPU and the host restores them', async () => {
    await hostRoom();
    const session = last().hostSession!;
    act(() => {
      session.request('guest-a', 'Aki');
      session.approve('guest-a', 1);
      session.ready('guest-a');
      session.ready();
      session.start();
    });
    fireEvent.click(screen.getByText(text('groupSeats'), { selector: 'summary' }));
    const before = structuredClone(session.state);
    const select = screen.getByLabelText(text('groupSwitch', { seat: 2 }));
    fireEvent.change(select, { target: { value: 'cpu' } });
    expect(last().control).toHaveBeenLastCalledWith(1, 'cpu');
    expect(session.state).toEqual(before);
    expect(within(select).getByRole('option', { name: text('groupHuman') })).toBeEnabled();
    fireEvent.change(select, { target: { value: 'human' } });
    expect(session.seats[1]).toMatchObject({ control: 'human', name: 'Aki' });
    expect(session.state).toEqual(before);
    expect(
      within(select).queryByRole('option', { name: text('groupOpen') }),
    ).not.toBeInTheDocument();
  });

  it('waits for a disconnected human and lets the host replace that seat with CPU', async () => {
    await hostRoom();
    const session = last().hostSession!;
    act(() => {
      session.request('guest-a', 'Aki');
      session.approve('guest-a', 1);
      session.ready('guest-a');
      session.ready();
      session.start();
      session.disconnect('guest-a');
    });
    fireEvent.click(screen.getByText(text('groupSeats'), { selector: 'summary' }));
    expect(
      screen.getByText(text('groupDisconnected'), { selector: '[role="status"]' }),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Roll the die' })).not.toBeInTheDocument();
    expect(screen.getByText(text('groupWaiting'))).toBeVisible();
    fireEvent.change(screen.getByLabelText(text('groupSwitch', { seat: 2 })), {
      target: { value: 'cpu' },
    });
    expect(screen.queryByText(text('groupWaiting'))).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll the die' })).toBeEnabled();
  });

  it('requires leave confirmation and ends the host room without navigating away', async () => {
    const view = await hostRoom();
    fireEvent.click(screen.getByRole('button', { name: text('leave') }));
    let dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(text('groupHostStops'))).toBeVisible();
    fireEvent.click(within(dialog).getByRole('button', { name: text('cancel') }));
    expect(last().stop).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: text('leave') }));
    dialog = screen.getByRole('alertdialog');
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: text('leave') }));
    });
    expect(last().stop).toHaveBeenCalledTimes(1);
    expect(last().hostSession?.closed).toBe(true);
    expect(view.onExit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: text('groupBackToSetup') })).toBeVisible();
  });

  it('keeps a joined guest out of host controls and disables Ready while CPU controls their seat', async () => {
    await mount({ name: 'Guest', roomName: 'Saturday Ludo', label: 'P-8E1234', transport: 'ble' });
    expect(last().start).toHaveBeenCalledWith('P-8E1234');
    const snapshot = guestSnapshot();
    act(() => {
      last().receiveSnapshot(snapshot);
    });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: text('groupStart') })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: text('ready') }));
    expect(last().ready).toHaveBeenCalledTimes(1);
    snapshot.seats[1]!.control = 'cpu';
    snapshot.revision++;
    act(() => {
      last().receiveSnapshot(snapshot);
    });
    expect(screen.getByRole('button', { name: text('ready') })).toBeDisabled();
    snapshot.seats[1]!.control = 'human';
    snapshot.revision++;
    act(() => {
      last().receiveSnapshot(snapshot);
    });
    expect(screen.getByRole('button', { name: text('ready') })).toBeEnabled();
  });

  it('shows guest waiting and the terminal host-left explanation', async () => {
    await mount({ name: 'Guest', roomName: 'Saturday Ludo', label: 'P-8E1234', transport: 'lan' });
    const snapshot = guestSnapshot();
    snapshot.state = createLudo(() => 0);
    snapshot.round = 1;
    snapshot.seats[0]!.connected = false;
    act(() => {
      last().receiveSnapshot(snapshot);
    });
    expect(screen.getByText(text('groupWaiting'))).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Roll the die' })).not.toBeInTheDocument();
    act(() => {
      last().status = 'ended';
      last().reason = 'hostLeft';
      last().notify();
    });
    expect(screen.getByText(text('groupHostLeft'))).toBeVisible();
    expect(screen.queryByRole('button', { name: text('leave') })).not.toBeInTheDocument();
  });
});

describe('Ludo local history', () => {
  it('reads four-player results without starting a connection and confirms one-record deletion', async () => {
    fixture.saved = [
      {
        id: 'd'.repeat(32),
        at: 1000,
        roomName: 'Saved Ludo',
        transport: 'ble',
        rounds: [
          {
            round: 1,
            names: ['Host', 'Aki', 'Yuki', 'CPU 4'],
            scores: [1, 4, 2, 0],
            winner: 1,
            finished: true,
          },
        ],
      },
    ];
    await mount();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: text('history') }));
    });
    expect(fixture.controllers).toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'Saved Ludo' })).toBeVisible();
    expect(screen.getByText('Host / Aki / Yuki / CPU 4')).toBeVisible();
    expect(screen.getByText(text('groupWinner', { name: 'Aki' }))).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: text('delete') }));
    const dialog = screen.getByRole('alertdialog');
    expect(fixture.remove).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: text('delete') }));
    });
    expect(fixture.remove).toHaveBeenCalledWith('d'.repeat(32));
    expect(screen.queryByRole('heading', { name: 'Saved Ludo' })).not.toBeInTheDocument();
    expect(fixture.controllers).toHaveLength(0);
  });

  it('requires confirmation before deleting all Nearby data', async () => {
    await mount();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: text('history') }));
    });
    fireEvent.click(screen.getByRole('button', { name: text('clear') }));
    const dialog = screen.getByRole('alertdialog');
    expect(fixture.clear).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: text('clear') }));
    });
    expect(fixture.clear).toHaveBeenCalledTimes(1);
    expect(fixture.controllers).toHaveLength(0);
  });
});

describe('Ludo room report and block controls', () => {
  it('reports only selected pending room/name text and confirms blocking that peer', async () => {
    await hostRoom();
    const controller = last();
    act(() => {
      controller.participants.set('link-private', { name: 'Aki', identity: 'f'.repeat(32) });
      controller.hostSession!.request('link-private', 'Aki');
    });
    const request = screen
      .getByRole('heading', { name: text('request', { name: 'Aki' }) })
      .closest('section')!;
    fireEvent.click(within(request).getByRole('button', { name: text('report') }));
    const report = screen.getByRole('dialog', { name: text('report') });
    const content = within(report).getByLabelText(text('reportContent')) as HTMLTextAreaElement;
    expect(content.value).toContain('Saturday Ludo\nAki');
    expect(content.value).not.toContain('link-private');
    expect(content.value).not.toContain('f'.repeat(32));
    expect(within(report).getByRole('button', { name: text('reportCopy') })).toBeDisabled();
    expect(controller.block).not.toHaveBeenCalled();
    fireEvent.click(within(report).getByRole('button', { name: text('cancel') }));
    fireEvent.click(within(request).getByRole('button', { name: text('blockPlayer') }));
    const confirmation = screen.getByRole('alertdialog');
    expect(within(confirmation).getByText(text('blockHistoryBody'))).toBeVisible();
    expect(controller.block).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(confirmation).getByRole('button', { name: text('blockPlayer') }));
    });
    expect(controller.block).toHaveBeenCalledWith('link-private');
    expect(controller.stop).not.toHaveBeenCalled();
    expect(controller.status).toBe('room');
  });

  it('lets the host block one approved participant without closing another seat', async () => {
    await hostRoom();
    const controller = last();
    act(() => {
      for (const [peer, name, seat] of [
        ['guest-a', 'Aki', 1],
        ['guest-b', 'Yuki', 2],
      ] as const) {
        controller.participants.set(peer, { name, identity: (seat === 1 ? 'd' : 'e').repeat(32) });
        controller.hostSession!.request(peer, name);
        controller.hostSession!.approve(peer, seat);
      }
    });
    const aki = screen.getByText('Aki').closest('.nearby-card')! as HTMLElement;
    fireEvent.click(within(aki).getByRole('button', { name: text('blockPlayer') }));
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: text('blockPlayer') }),
      );
    });
    expect(controller.block).toHaveBeenCalledWith('guest-a');
    expect(controller.hostSession!.seats[1]!.connected).toBe(false);
    expect(controller.hostSession!.seats[2]!.connected).toBe(true);
    expect(controller.status).toBe('room');
  });

  it('lets a guest report the host and block them before approval', async () => {
    await mount({ name: 'Guest', roomName: 'Saturday Ludo', label: 'P-8E1234', transport: 'ble' });
    const controller = last();
    act(() => {
      controller.status = 'connecting';
      controller.participants.set('host-link', { name: 'Host', identity: 'f'.repeat(32) });
      controller.notify();
    });
    fireEvent.click(screen.getByRole('button', { name: text('report') }));
    const report = screen.getByRole('dialog');
    expect(
      (within(report).getByLabelText(text('reportContent')) as HTMLTextAreaElement).value,
    ).toContain('Saturday Ludo\nHost');
    fireEvent.click(within(report).getByRole('button', { name: text('cancel') }));
    fireEvent.click(screen.getByRole('button', { name: text('blockPlayer') }));
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: text('blockPlayer') }),
      );
    });
    expect(controller.block).toHaveBeenCalledWith('host-link');
    expect(controller.status).toBe('ended');
  });

  it('reports one saved group without attaching its identifiers or other history', async () => {
    fixture.saved = [
      {
        id: 'd'.repeat(32),
        at: 1000,
        roomName: 'Chosen game',
        transport: 'ble',
        rounds: [
          {
            round: 1,
            names: ['Host', 'Aki', 'Yuki', 'CPU 4'],
            scores: [0, 0, 0, 0],
            winner: null,
            finished: false,
          },
        ],
      },
      {
        id: 'e'.repeat(32),
        at: 2000,
        roomName: 'Other private game',
        transport: 'lan',
        rounds: [
          {
            round: 1,
            names: ['Other host', 'Other guest', 'CPU 3', 'CPU 4'],
            scores: [0, 0, 0, 0],
            winner: null,
            finished: false,
          },
        ],
      },
    ];
    await mount();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: text('history') }));
    });
    const chosen = screen.getByRole('heading', { name: 'Chosen game' }).closest('article')!;
    fireEvent.click(within(chosen).getByRole('button', { name: text('report') }));
    const content = within(screen.getByRole('dialog')).getByLabelText(
      text('reportContent'),
    ) as HTMLTextAreaElement;
    expect(content.value).toContain('Chosen game\nHost\nAki\nYuki\nCPU 4');
    expect(content.value).not.toContain('d'.repeat(32));
    expect(content.value).not.toContain('Other private game');
    expect(content.value).not.toContain('Other guest');
    expect(fixture.controllers).toHaveLength(0);
  });

  it('reports and hides a discovered listing locally without joining or blocking', async () => {
    await mount({ name: 'Guest', roomName: 'Saturday Ludo', label: 'P-8E1234', transport: 'ble' });
    const controller = last();
    fireEvent.click(screen.getByRole('button', { name: text('report') }));
    const report = screen.getByRole('dialog');
    const content = within(report).getByLabelText(text('reportContent')) as HTMLTextAreaElement;
    expect(content.value).toContain('Saturday Ludo');
    expect(content.value).not.toContain('P-8E1234');
    expect(content.value).not.toContain('peer-ludo');
    fireEvent.click(within(report).getByRole('button', { name: text('cancel') }));
    fireEvent.click(screen.getByRole('button', { name: text('hideListing') }));
    expect(screen.queryByRole('button', { name: /Saturday Ludo/ })).not.toBeInTheDocument();
    expect(screen.getByText(text('hideListingHint'))).toBeVisible();
    expect(controller.join).not.toHaveBeenCalled();
    expect(controller.block).not.toHaveBeenCalled();
    expect(controller.stop).not.toHaveBeenCalled();
  });
});

describe('Ludo room navigation cleanup', () => {
  it.each(['searching', 'connecting'])(
    'stops an unapproved guest %s before leaving the view',
    async (status) => {
      const view = await mount({
        name: 'Guest',
        roomName: 'Saturday Ludo',
        label: 'P-8E1234',
        transport: 'ble',
      });
      const controller = last();
      let finish!: () => void;
      const stopped = new Promise<void>((resolve) => {
        finish = resolve;
      });
      controller.stop.mockImplementation(async () => {
        await stopped;
        controller.status = 'ended';
        controller.notify();
      });
      act(() => {
        controller.status = status;
        controller.notify();
      });
      expect(view.onActiveChange).toHaveBeenLastCalledWith(false);
      if (status === 'connecting') fireEvent.keyDown(window, { key: 'Escape' });
      else fireEvent.click(screen.getByRole('button', { name: text('back') }));
      expect(controller.stop).toHaveBeenCalledTimes(1);
      expect(view.onExit).not.toHaveBeenCalled();
      await act(async () => {
        finish();
        await stopped;
      });
      expect(view.onExit).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['searching', 'connecting'])(
    'stops an unapproved guest %s when hidden',
    async (status) => {
      const view = await mount({
        name: 'Guest',
        roomName: 'Saturday Ludo',
        label: 'P-8E1234',
        transport: 'lan',
      });
      const controller = last();
      act(() => {
        controller.status = status;
        controller.notify();
      });
      await act(async () => {
        view.setVisible(false);
      });
      expect(controller.stop).toHaveBeenCalledTimes(1);
      expect(controller.status).toBe('ended');
      expect(view.onExit).not.toHaveBeenCalled();
    },
  );

  it.each(['host', 'guest'])(
    'preserves an approved %s room on Back and while hidden',
    async (role) => {
      const view =
        role === 'host'
          ? await hostRoom()
          : await mount({
              name: 'Guest',
              roomName: 'Saturday Ludo',
              label: 'P-8E1234',
              transport: 'ble',
            });
      const controller = last();
      if (role === 'guest')
        act(() => {
          controller.receiveSnapshot(guestSnapshot());
        });
      expect(view.onActiveChange).toHaveBeenLastCalledWith(true);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: text('back') }));
      });
      expect(view.onExit).toHaveBeenCalledTimes(1);
      await act(async () => {
        view.setVisible(false);
      });
      expect(controller.stop).not.toHaveBeenCalled();
      expect(controller.status).toBe('room');
    },
  );

  it.each(['delete', 'clear'] as const)(
    'does not reopen history after Back during a pending %s',
    async (operation) => {
      fixture.saved = [
        { id: 'd'.repeat(32), at: 1000, roomName: 'Saved Ludo', transport: 'ble', rounds: [] },
      ];
      await mount();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: text('history') }));
      });
      let finish!: () => void;
      const written = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const mutation = operation === 'delete' ? fixture.remove : fixture.clear;
      mutation.mockImplementationOnce(() => written);
      fireEvent.click(screen.getByRole('button', { name: text(operation) }));
      fireEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: text(operation) }),
      );
      expect(mutation).toHaveBeenCalledTimes(1);
      const reads = fixture.load.mock.calls.length;
      fireEvent.click(screen.getByRole('button', { name: text('back') }));
      fireEvent.change(screen.getByLabelText(text('name')), { target: { value: 'New name' } });
      await act(async () => {
        finish();
        await written;
      });
      expect(screen.queryByRole('heading', { name: text('history') })).not.toBeInTheDocument();
      expect(screen.getByLabelText(text('name'))).toHaveValue('New name');
      expect(fixture.load).toHaveBeenCalledTimes(reads);
    },
  );
});
