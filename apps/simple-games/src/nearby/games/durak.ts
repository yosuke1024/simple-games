import {
  createSession,
  step,
  cpuView,
  chooseCpuMove,
  type Session,
  type Action,
} from '../../games/durak/game/index';
import { project, validView } from '../../games/durak/game/view';
import type { GroupGame } from '../groupSession';
import { record, integer } from '../gameTypes';
import { exactKeys } from './validation';
import { hostRandom } from './groupCards';
export { project as projectDurak, validView as isDurakView } from '../../games/durak/game/view';
const over = (raw: unknown) =>
  record(raw) && (raw.over === true || ['won', 'lost', 'draw'].includes(String(raw.status)));
export const game: GroupGame = {
  id: 'durak',
  capacity: 2,
  create: () => createSession(0, hostRandom),
  valid: validView,
  project: (raw, seat) => project(raw as Session, seat),
  turn: (raw) => (raw as Session).turn,
  finished: over,
  apply: (raw, seat, a) => {
    const s = raw as Session;
    if (
      s.turn !== seat ||
      !record(a) ||
      !(
        ((a.kind === 'take' || a.kind === 'done') && exactKeys(a, ['kind'])) ||
        ((a.kind === 'attack' || a.kind === 'defend') &&
          exactKeys(a, ['kind', 'card']) &&
          integer(a.card, 0, 51))
      )
    )
      return null;
    return step(s, a as Action);
  },
  cpu: (raw) => chooseCpuMove(cpuView(raw as Session)),
  result: (raw) => {
    if (!over(raw)) return null;
    const v = validView(raw) ? raw : project(raw as Session, 0);
    return { scores: [...v.counts], winner: v.winners.length === 1 ? v.winners[0]! : null };
  },
};
