import {
  createSession,
  step,
  cpuView,
  chooseCpuMove,
  type Session,
  type Action,
} from '../../games/spades/game';
import { project, validView } from '../../games/spades/game/view';
import type { GroupGame } from '../groupSession';
import { record, integer } from '../gameTypes';
import { exactKeys } from './validation';
import { hostRandom } from './groupCards';
export { project as projectSpades, validView as isSpadesView } from '../../games/spades/game/view';
const over = (raw: unknown) =>
  record(raw) && (raw.over === true || ['won', 'lost', 'draw'].includes(String(raw.status)));
export const game: GroupGame = {
  id: 'spades',
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
        (a.kind === 'next' && exactKeys(a, ['kind'])) ||
        (a.kind === 'bid' && exactKeys(a, ['kind', 'bid']) && integer(a.bid, 0, 13)) ||
        (a.kind === 'play' && exactKeys(a, ['kind', 'card']) && integer(a.card, 0, 51))
      )
    )
      return null;
    return step(s, a as Action, hostRandom);
  },
  cpu: (raw) => chooseCpuMove(cpuView(raw as Session)),
  result: (raw) => {
    if (!over(raw)) return null;
    const v = validView(raw) ? raw : project(raw as Session, 0);
    return { scores: [v.scores[0]!, v.scores[1]!, v.scores[0]!, v.scores[1]!], winner: null };
  },
};
