import {
  createSession,
  step,
  cpuView,
  chooseCpuMove,
  type Session,
  type Action,
} from '../../games/indian-rummy/game';
import { project, validView } from '../../games/indian-rummy/game/view';
import type { GroupGame } from '../groupSession';
import { record, integer } from '../gameTypes';
import { exactKeys } from './validation';
import { hostRandom } from './groupCards';
export {
  project as projectIndianRummy,
  validView as isIndianRummyView,
} from '../../games/indian-rummy/game/view';
const over = (raw: unknown) =>
  record(raw) && (raw.over === true || ['won', 'lost', 'draw'].includes(String(raw.status)));
export const game: GroupGame = {
  id: 'indian-rummy',
  capacity: 4,
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
        (a.kind === 'draw' &&
          exactKeys(a, ['kind', 'source']) &&
          (a.source === 'stock' || a.source === 'discard')) ||
        ((a.kind === 'discard' || a.kind === 'declare') &&
          exactKeys(a, ['kind', 'card']) &&
          integer(a.card, 0, 105))
      )
    )
      return null;
    return step(s, a as Action, hostRandom);
  },
  cpu: (raw) => chooseCpuMove(cpuView(raw as Session)),
  result: (raw) => {
    if (!over(raw)) return null;
    const v = validView(raw) ? raw : project(raw as Session, 0);
    return { scores: [...v.penalties], winner: v.winners.length === 1 ? v.winners[0]! : null };
  },
};
