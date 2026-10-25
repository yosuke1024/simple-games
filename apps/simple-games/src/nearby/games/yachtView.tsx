import '../../games/yacht/i18n';
import '../../games/yacht/ui/yacht.css';
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../../state/SettingsContext';
import {
  YachtPlaySurface,
  type DiceRoll,
  type SheetFlash,
} from '../../games/yacht/ui/components/YachtPlaySurface';
import { useGameKeys } from '../../ui/useGameKeys';
import { useNearbyText } from '../i18n';
import type { NearbyBoardProps } from '../gameTypes';
import { CATEGORIES, count, finished, totals, turn, type Match } from '../yacht';

export default function YachtView({
  match,
  seat,
  names,
  canAct,
  act,
  statusLabel,
}: NearbyBoardProps) {
  const { t } = useSettings();
  const n = useNearbyText();
  const m = match.state as Match;
  const opponent = seat === 0 ? 1 : 0;
  const points = totals(m);
  const previous = useRef<Match>(m);
  const [lastRoll, setLastRoll] = useState<DiceRoll | null>(null);
  const [flash, setFlash] = useState<SheetFlash | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = m;
    if (m.round !== before.round) {
      setLastRoll(null);
      setFlash(null);
      return;
    }
    if (m.rolls > before.rolls)
      setLastRoll({ rollIndex: m.revision, rolled: before.held.map((held) => !held) });
    for (const player of [seat, opponent]) {
      const category = CATEGORIES.findIndex(
        (_, i) => before.scores[player]![i] === null && m.scores[player]![i] !== null,
      );
      if (category !== -1) {
        setFlash({
          seat: player === seat ? 'player' : 'cpu',
          category: CATEGORIES[category]!,
          key: m.revision,
        });
        break;
      }
    }
  }, [m, seat, opponent]);
  const canRoll = canAct && m.rolls < 3 && !m.held.every(Boolean);
  const canHold = canAct && m.rolls > 0 && m.rolls < 3;
  useGameKeys((event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return false;
    if ((event.key === 'r' || event.key === 'R') && canRoll) {
      act({ kind: 'roll' });
      return true;
    }
    const index = Number(event.key) - 1;
    if (canHold && Number.isInteger(index) && index >= 0 && index < 5) {
      act({ kind: 'hold', index });
      return true;
    }
    return false;
  }, canAct);
  const status = finished(m)
    ? n('completed')
    : n('turn', { name: names[turn(m)]!, rolls: m.rolls });
  return (
    <div>
      <div className="nearby-game-status">
        <strong>{Math.min(count(m.scores[seat]) + 1, 12)}/12</strong>
        <span>{m.rolls}/3</span>
      </div>
      <YachtPlaySurface
        dice={m.dice}
        held={m.held}
        rolled={m.rolls > 0}
        rollsUsed={m.rolls}
        canHold={canHold}
        canRoll={canRoll}
        playing={canAct}
        lastRoll={lastRoll}
        onRoll={() => act({ kind: 'roll' })}
        onToggle={(index) => act({ kind: 'hold', index })}
        onScore={(category) => act({ kind: 'score', category })}
        scores={m.scores[seat]}
        cpuScores={m.scores[opponent]}
        total={points[seat]!}
        cpuTotal={points[opponent]!}
        names={[names[seat]!, names[opponent]!]}
        columnLabels={[t('yachtYou'), n('opponent')]}
        flash={flash}
        waitingLabel={statusLabel ?? status}
      />
    </div>
  );
}

// One lazy entry carries this game's view and its matching protocol adapter.
export { adapter } from './yacht';
