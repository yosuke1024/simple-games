import { integer, record } from './gameTypes';
import { isPlayerName, isRoomName } from './session';

export type Control = 'open' | 'human' | 'cpu';
export interface GroupSeat {
  name: string;
  control: Control;
  connected: boolean;
  ready: boolean;
  epoch: number;
}
export interface GroupGame {
  capacity: number;
  create(): unknown;
  valid(state: unknown): boolean;
  turn(state: unknown): number;
  finished(state: unknown): boolean;
  apply(state: unknown, seat: number, action: unknown): unknown | null;
  cpu(state: unknown): unknown | null;
}
export interface GroupSnapshot {
  group: 1;
  type: 'state';
  room: string;
  title: string;
  revision: number;
  round: number;
  you: number;
  seats: GroupSeat[];
  state: unknown | null;
}
interface Options {
  name: string;
  title: string;
  room: string;
  game: GroupGame;
  send(peer: string, message: unknown): void;
  changed(): void;
}

/** Host-owned seats survive peer departure. A controller change never resets a position. */
export class GroupSession {
  readonly seats: GroupSeat[];
  readonly pending = new Map<string, string>();
  readonly members = new Map<string, number>();
  readonly acknowledgements = new Map<string, number>();
  private owners: (string | null)[];
  state: unknown | null = null;
  revision = 0;
  round = 0;
  closed = false;

  constructor(readonly options: Options) {
    if (
      !isPlayerName(options.name) ||
      !isRoomName(options.title) ||
      !integer(options.game.capacity, 2, 4)
    )
      throw new Error('Invalid group');
    this.seats = Array.from({ length: options.game.capacity }, (_, i) => ({
      name: i === 0 ? options.name : '',
      control: i === 0 ? 'human' : 'cpu',
      connected: i === 0,
      ready: i !== 0,
      epoch: 0,
    }));
    this.owners = this.seats.map((_, i) => (i === 0 ? 'host' : null));
  }
  get synchronized(): boolean {
    return this.seats.every(
      (seat, i) =>
        seat.control !== 'human' ||
        (seat.connected &&
          (i === 0 || this.acknowledgements.get(this.owners[i]!) === this.revision)),
    );
  }
  get canStart(): boolean {
    return (
      !this.closed &&
      (this.state === null || this.options.game.finished(this.state)) &&
      this.seats.every(
        (s) => s.control === 'cpu' || (s.control === 'human' && s.connected && s.ready),
      )
    );
  }
  snapshot(peer = 'host'): GroupSnapshot {
    return {
      group: 1,
      type: 'state',
      room: this.options.room,
      title: this.options.title,
      revision: this.revision,
      round: this.round,
      you: peer === 'host' ? 0 : (this.members.get(peer) ?? -1),
      seats: this.seats.map((s) => ({ ...s })),
      state: structuredClone(this.state),
    };
  }
  private publish() {
    this.revision++;
    for (const peer of this.members.keys()) {
      const seat = this.members.get(peer)!;
      if (this.seats[seat]?.connected) this.options.send(peer, this.snapshot(peer));
    }
    this.options.changed();
  }
  request(peer: string, name: string) {
    if (this.closed || this.pending.size >= 3 || this.members.has(peer) || !isPlayerName(name))
      return false;
    this.pending.set(peer, name);
    this.options.changed();
    return true;
  }
  approve(peer: string, seat: number): boolean {
    const name = this.pending.get(peer);
    const target = this.seats[seat];
    if (
      this.closed ||
      !name ||
      seat === 0 ||
      !target ||
      (target.control === 'human' && target.connected)
    )
      return false;
    const previous = this.owners[seat];
    if (previous) {
      this.members.delete(previous);
      this.acknowledgements.delete(previous);
      if (previous !== peer) this.options.send(previous, { group: 1, type: 'replaced' });
    }
    this.pending.delete(peer);
    this.members.set(peer, seat);
    this.owners[seat] = peer;
    Object.assign(target, {
      name,
      control: 'human',
      connected: true,
      ready: this.state !== null && !this.options.game.finished(this.state),
      epoch: target.epoch + 1,
    });
    this.publish();
    return true;
  }
  reject(peer: string) {
    this.pending.delete(peer);
    this.options.send(peer, { group: 1, type: 'declined' });
    this.options.changed();
  }
  disconnect(peer: string) {
    this.pending.delete(peer);
    const seat = this.members.get(peer);
    if (seat !== undefined) {
      this.seats[seat]!.connected = false;
      this.seats[seat]!.ready = false;
      this.seats[seat]!.epoch++;
      this.acknowledgements.delete(peer);
      this.members.delete(peer);
      this.owners[seat] = null;
      this.publish();
    } else this.options.changed();
  }
  control(seat: number, control: Control): boolean {
    const target = this.seats[seat];
    if (
      this.closed ||
      !target ||
      (seat === 0 && control !== 'human') ||
      (this.state !== null && control === 'open') ||
      (control === 'human' && (!target.connected || !this.owners[seat]))
    )
      return false;
    target.control = control;
    target.epoch++;
    target.ready =
      control === 'cpu' ||
      (this.state !== null && !this.options.game.finished(this.state) && control === 'human');
    this.publish();
    return true;
  }
  ready(peer = 'host') {
    const seat = peer === 'host' ? 0 : this.members.get(peer);
    if (
      this.closed ||
      seat === undefined ||
      (this.state !== null && !this.options.game.finished(this.state))
    )
      return;
    if (this.seats[seat]!.control !== 'human' || !this.seats[seat]!.connected) return;
    this.seats[seat]!.ready = true;
    this.publish();
  }
  start(): boolean {
    if (!this.canStart) return false;
    this.state = this.options.game.create();
    this.round++;
    this.publish();
    return true;
  }
  canAct(seat: number): boolean {
    return (
      !this.closed &&
      this.state !== null &&
      !this.options.game.finished(this.state) &&
      this.synchronized &&
      this.options.game.turn(this.state) === seat
    );
  }
  act(peer: string, revision: number, epoch: number, action: unknown): boolean {
    const seat = peer === 'host' ? 0 : this.members.get(peer);
    if (
      seat === undefined ||
      this.owners[seat] !== peer ||
      this.seats[seat]!.control !== 'human' ||
      revision !== this.revision ||
      epoch !== this.seats[seat]!.epoch ||
      !this.canAct(seat)
    )
      return false;
    return this.apply(seat, action);
  }
  private apply(seat: number, action: unknown): boolean {
    const next = this.options.game.apply(this.state, seat, action);
    if (next === null) return false;
    this.state = next;
    if (this.options.game.finished(next)) for (const s of this.seats) s.ready = s.control === 'cpu';
    this.publish();
    return true;
  }
  cpuStep(): boolean {
    if (this.state === null) return false;
    const seat = this.options.game.turn(this.state);
    if (!this.canAct(seat) || this.seats[seat]!.control !== 'cpu') return false;
    const action = this.options.game.cpu(this.state);
    return action !== null && this.apply(seat, action);
  }
  receive(peer: string, value: unknown) {
    if (this.closed || !record(value) || value.group !== 1) return;
    if (value.type === 'join') {
      if (isPlayerName(value.name)) this.request(peer, value.name);
      return;
    }
    if (!this.members.has(peer) || value.room !== this.options.room) return;
    if (value.type === 'ack' && value.revision === this.revision) {
      this.acknowledgements.set(peer, this.revision);
      if (this.synchronized)
        for (const member of this.members.keys())
          if (this.seats[this.members.get(member)!]?.connected)
            this.options.send(member, {
              group: 1,
              type: 'turnReady',
              room: this.options.room,
              revision: this.revision,
            });
      this.options.changed();
    } else if (value.type === 'ready') this.ready(peer);
    else if (
      value.type === 'action' &&
      integer(value.revision, 0, this.revision) &&
      integer(value.epoch, 0, 1000000)
    )
      this.act(peer, value.revision, value.epoch, value.action);
  }
  end() {
    if (this.closed) return;
    this.closed = true;
    for (const peer of new Set([...this.members.keys(), ...this.pending.keys()]))
      this.options.send(peer, { group: 1, type: 'ended' });
    this.options.changed();
  }
}

export function validGroupSnapshot(value: unknown, game: GroupGame): value is GroupSnapshot {
  if (
    !record(value) ||
    value.group !== 1 ||
    value.type !== 'state' ||
    typeof value.room !== 'string' ||
    !/^[a-f0-9]{32}$/.test(value.room) ||
    !isRoomName(value.title) ||
    !integer(value.revision, 0, 1000000) ||
    !integer(value.round, 0, 10000) ||
    !integer(value.you, 0, game.capacity - 1) ||
    !Array.isArray(value.seats) ||
    value.seats.length !== game.capacity ||
    (value.state !== null && !game.valid(value.state))
  )
    return false;
  return value.seats.every(
    (s) =>
      record(s) &&
      ['open', 'human', 'cpu'].includes(String(s.control)) &&
      (s.name === '' || isPlayerName(s.name)) &&
      typeof s.connected === 'boolean' &&
      typeof s.ready === 'boolean' &&
      integer(s.epoch, 0, 1000000),
  );
}
