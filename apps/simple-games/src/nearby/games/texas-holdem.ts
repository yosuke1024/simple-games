import {
  createSession,
  step,
  cpuView,
  chooseCpuMove,
  type Session,
  type Action,
} from '../../games/texas-holdem/game/index';
import { project, validView } from '../../games/texas-holdem/game/view';
import type { GroupGame } from '../groupSession';
import { record, integer } from '../gameTypes';
import { exactKeys } from './validation';
import { hostRandom } from './groupCards';
export {
  project as projectTexasHoldem,
  validView as isTexasHoldemView,
} from '../../games/texas-holdem/game/view';
const over = (raw: unknown) =>
  record(raw) && (raw.over === true || ['won', 'lost', 'draw'].includes(String(raw.status)));
export const game: GroupGame = {
  id: 'texas-holdem',
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
        (['fold', 'check', 'call', 'all-in', 'next'].includes(String(a.kind)) &&
          exactKeys(a, ['kind'])) ||
        (a.kind === 'raise' && exactKeys(a, ['kind', 'to']) && integer(a.to, 0, 4000))
      )
    )
      return null;
    return step(s, a as Action, hostRandom);
  },
  cpu: (raw) => chooseCpuMove(cpuView(raw as Session)),
  result: (raw) => {
    if (!over(raw)) return null;
    const v = validView(raw) ? raw : project(raw as Session, 0);
    return { scores: [...v.stacks], winner: v.winners.length === 1 ? v.winners[0]! : null };
  },
};
