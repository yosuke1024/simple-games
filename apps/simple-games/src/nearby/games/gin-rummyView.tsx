import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { bestMeldPlan } from '../../games/gin-rummy/game/melds';
import { GinRummyTable } from '../../games/gin-rummy/ui/components/GinRummyTable';
import { HandResultOverlay } from '../../games/gin-rummy/ui/components/HandResultOverlay';
import '../../games/gin-rummy/ui/gin-rummy.css';
import '../../games/gin-rummy/i18n';
import type { NearbyBoardProps } from '../gameTypes';
import { adapter, isGinView } from './gin-rummy';

export default function GinRummyView({ match, seat, names, canAct, act }: NearbyBoardProps) {
  const { t } = useSettings();
  const position = `${match.round}:${match.revision}`;
  const [choice, setChoice] = useState<{ position: string; card: number | null; knock: boolean }>({
    position: '',
    card: null,
    knock: false,
  });
  if (!isGinView(match.state) || match.state.seat !== seat) return null;
  const v = match.state;
  const selected = choice.position === position ? choice.card : null;
  const knocking = choice.position === position && choice.knock;
  const active = canAct && v.turn === seat && v.phase !== 'over';
  const peer = seat === 0 ? 1 : 0;
  return (
    <div className="gr-body">
      <div className="gr-top-facts">
        <span className="gr-match-score">
          {names[seat]} {v.scores[seat]} · {names[peer]} {v.scores[peer]}
        </span>
        <span className="gr-deadwood">
          {t('ginDeadwood')} {bestMeldPlan(v.cards).deadwoodValue}
        </span>
      </div>
      <GinRummyTable
        view={v}
        opponentLabel={`${names[peer]} - ${v.opponentCount}`}
        active={active}
        knockMode={knocking}
        selected={selected}
        onDrawStock={() => active && act({ kind: 'draw-stock' })}
        onDrawDiscard={() => active && act({ kind: 'draw-discard' })}
        onCardTap={(card) => {
          if (!active) return;
          if (selected === card) act({ kind: knocking ? 'knock' : 'discard', card });
          else setChoice({ position, card, knock: knocking });
        }}
      />
      <p className="gr-line" role="status">
        {v.phase === 'over'
          ? ''
          : !active
            ? ''
            : knocking
              ? t('ginKnockPrompt')
              : v.phase === 'upcard'
                ? t('ginUpcardPrompt')
                : v.phase === 'draw'
                  ? t('ginDrawPrompt')
                  : t('ginDiscardPrompt')}
      </p>
      <div className="action-bar gr-actions">
        {active && v.phase === 'upcard' ? (
          <>
            <button className="action-btn" onClick={() => act({ kind: 'take-upcard' })}>
              {t('ginTake')}
            </button>
            <button className="action-btn" onClick={() => act({ kind: 'pass-upcard' })}>
              {t('ginPass')}
            </button>
          </>
        ) : null}
        {active && v.knockable.length > 0 ? (
          <button
            className="action-btn"
            aria-pressed={knocking}
            onClick={() => setChoice({ position, card: null, knock: !knocking })}
          >
            {knocking ? t('cancel') : t('ginKnock')}
          </button>
        ) : null}
      </div>
      {v.outcome ? (
        <HandResultOverlay
          inline
          outcome={v.outcome}
          scores={v.scores}
          names={names}
          localSeat={seat}
          onNext={() => act({ kind: 'next' })}
          nextDisabled={!canAct || seat !== 0 || adapter.finished(v)}
        />
      ) : null}
    </div>
  );
}

// One lazy entry carries this game's view and its matching protocol adapter.
export { adapter } from './gin-rummy';
