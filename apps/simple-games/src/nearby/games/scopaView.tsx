import { useEffect, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { captureOptions } from '../../games/scopa/game/engine';
import { valueOf } from '../../games/scopa/game/cards';
import { CaptureBand } from '../../games/scopa/ui/components/CaptureBand';
import { DealTable } from '../../games/scopa/ui/components/DealTable';
import { Hand, PrimieraStrip, TableArea } from '../../games/scopa/ui/components/ScopaTable';
import { liftOf, pickedSum, tapTable, tappableCards } from '../../games/scopa/ui/selection';
import '../../games/scopa/ui/scopa.css';
import '../../games/scopa/i18n';
import type { NearbyBoardProps } from '../gameTypes';
import { adapter, isScopaView } from './scopa';

export default function ScopaView({ match, seat, names, canAct, act }: NearbyBoardProps) {
  const { t } = useSettings();
  const position = `${match.round}:${match.revision}`;
  const [choice, setChoice] = useState<{
    position: string;
    card: number | null;
    picked: readonly number[];
  }>({ position: '', card: null, picked: [] });
  const v = isScopaView(match.state) && match.state.seat === seat ? match.state : null;
  useEffect(() => {
    if (!v || v.phase !== 'refill' || seat !== 0 || !canAct) return;
    const timer = setTimeout(() => act({ kind: 'refill' }), 450);
    return () => clearTimeout(timer);
  }, [v, seat, canAct, act]);
  if (!v) return null;
  const active = canAct && v.turn === seat && v.phase === 'play';
  const held = active && choice.position === position ? choice.card : null;
  const picked = held === null ? [] : choice.picked;
  const lift = held === null ? null : liftOf(v.table, held);
  const tappable = active ? tappableCards(lift, picked) : new Set<number>();
  const canTake = new Set(v.hand.filter((card) => captureOptions(v.table, card).length > 0));
  const lower = () => setChoice({ position, card: null, picked: [] });
  const play = (move: { card: number; captured: readonly number[] }) => {
    if (active) {
      act({ kind: 'play', ...move });
      lower();
    }
  };
  const line =
    v.phase === 'over'
      ? ''
      : v.phase === 'refill'
        ? t('scopaLineDealing')
        : !active
          ? ''
          : !lift
            ? t('scopaLineYourTurn')
            : lift.kind === 'place'
              ? t('scopaLinePlace')
              : lift.options.length === 1
                ? t('scopaLineTakeOne')
                : lift.kind === 'same'
                  ? t('scopaLineChooseSame')
                  : t('scopaLineBuildSum', { n: valueOf(lift.card), sum: pickedSum(picked) });
  return (
    <div>
      <CaptureBand view={v} scores={v.scores} flash={null} names={names} localSeat={seat} />
      <div className="sc-body">
        <TableArea
          view={v}
          tappable={tappable}
          picked={picked}
          canPlace={active && lift?.kind === 'place'}
          folding={null}
          onPlace={() => {
            if (lift?.kind === 'place') play({ card: lift.card, captured: [] });
          }}
          onTableTap={(card) => {
            const tap = tapTable(lift, picked, card);
            if (tap.kind === 'take') play(tap.move);
            else if (tap.kind === 'group') setChoice({ position, card: held, picked: tap.picked });
          }}
        />
        <p className="sc-line" role="status">
          {line}
        </p>
        <Hand
          hand={v.hand}
          active={active}
          canTake={canTake}
          lifted={held}
          onHandTap={(card) => {
            if (!active) return;
            if (held !== card) {
              setChoice({ position, card, picked: [] });
              return;
            }
            const options = captureOptions(v.table, card);
            if (options.length === 1) play({ card, captured: options[0]! });
            else lower();
          }}
        />
        <PrimieraStrip taken={v.captured[seat]} />
      </div>
      {v.outcome ? (
        <div className="result">
          <h3>{t('scopaDealTitle', { n: v.dealNumber })}</h3>
          <DealTable outcome={v.outcome} names={names} localSeat={seat} />
          <button
            className="btn btn-primary"
            disabled={!canAct || seat !== 0 || adapter.finished(v)}
            onClick={() => act({ kind: 'next' })}
          >
            {t('scopaNextDeal')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

// One lazy entry carries this game's view and its matching protocol adapter.
export { adapter } from './scopa';
