import { useState } from 'react';
import '../../games/hearts/i18n';
import '../../games/hearts/ui/hearts.css';
import { HeartsHand } from '../../games/hearts/ui/components/HeartsHand';
import { HeartsTable } from '../../games/hearts/ui/components/HeartsTable';
import { legalPlaysIn, passDirectionOf, trickWinnerOf } from '../../games/hearts/game/types';
import { useSettings } from '../../state/SettingsContext';
import type { GroupBoardProps } from '../groupGames';
import { isHeartsView } from './hearts';
export default function HeartsBoard({
  state,
  seat,
  names,
  canAct,
  act,
  revision,
}: GroupBoardProps) {
  const { t } = useSettings();
  const [selection, setSelection] = useState<{ revision: number; cards: number[] }>({
    revision: -1,
    cards: [],
  });
  const selected = selection.revision === revision ? selection.cards : [];
  const setSelected = (cards: number[]) => setSelection({ revision, cards });
  const [lift, setLift] = useState<{ revision: number; card: number | null }>({
    revision: -1,
    card: null,
  });
  const lifted = lift.revision === revision ? lift.card : null;
  const setLifted = (card: number | null) => setLift({ revision, card });
  if (!isHeartsView(state, seat)) return null;
  const s = state,
    passing = s.phase === 'passing',
    chosen = selected.filter((c) => s.hand.includes(c));
  const legal = legalPlaysIn({
    cards: s.hand,
    leadCard: s.played[0] ?? null,
    firstTrick: s.tricks.length === 0,
    heartsBroken: s.heartsBroken,
  });
  const tap = (card: number) => {
    if (!canAct) return;
    if (passing && chosen.includes(card)) {
      setSelected(chosen.filter((c) => c !== card));
      setLifted(null);
    } else if (lifted !== card) setLifted(card);
    else {
      if (passing) {
        if (chosen.length < 3) setSelected([...chosen, card]);
      } else act({ kind: 'play', card });
      setLifted(null);
    }
  };
  return (
    <div className="ht-body">
      <HeartsTable
        hand={s}
        counts={s.counts}
        scores={s.scores}
        names={names}
        perspective={seat}
        folding={null}
        lastTrickWinner={s.tricks.length ? trickWinnerOf(s.tricks.at(-1)!) : null}
      />
      <p>
        {names[seat]} · {s.scores[seat]} (+{s.taken[seat]})
      </p>
      <HeartsHand
        cards={passing ? s.hand.filter((c) => !chosen.includes(c)) : s.hand}
        chosen={passing ? chosen : []}
        passing={passing}
        takeable={!canAct ? [] : passing ? (chosen.length < 3 ? s.hand : chosen) : legal}
        active={canAct}
        lifted={lifted}
        direction={passDirectionOf(s.passOffset)}
        onCardTap={tap}
      />
      {passing ? (
        <button
          className="btn btn-primary"
          disabled={!canAct || chosen.length !== 3}
          onClick={() => {
            act({ kind: 'pass', cards: chosen });
            setSelected([]);
            setLifted(null);
          }}
        >
          {t('heartsPassConfirm')}
        </button>
      ) : null}
      {s.phase === 'over' && !s.over ? (
        <>
          <div>
            {names.map((name, i) => (
              <p key={i}>
                {name} · +{s.delta[i]} / {s.scores[i]}
              </p>
            ))}
          </div>
          <button
            className="btn btn-primary"
            disabled={!canAct}
            onClick={() => act({ kind: 'next' })}
          >
            {t('heartsNextHand')}
          </button>
        </>
      ) : null}
    </div>
  );
}
export { game } from './hearts';
