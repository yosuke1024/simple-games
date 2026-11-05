import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { callAmount, canRaise, evaluate, type Action } from '../../game';
import type { View } from '../../game/view';
import { Back, Face, Hand, Seats, Status, useTableNames } from './TableParts';
const rankKeys = [
  'texasHoldemRank_0',
  'texasHoldemRank_1',
  'texasHoldemRank_2',
  'texasHoldemRank_3',
  'texasHoldemRank_4',
  'texasHoldemRank_5',
  'texasHoldemRank_6',
  'texasHoldemRank_7',
  'texasHoldemRank_8',
] as const;
export function Table({
  view: v,
  canAct,
  act,
  names,
}: {
  view: View;
  canAct: boolean;
  act: (action: Action) => void;
  names?: readonly string[];
}) {
  const { t } = useSettings(),
    name = useTableNames(v.you, names);
  const yours = canAct && !v.over && v.turn === v.you;
  const own = { ...v, turn: v.you },
    call = callAmount(own),
    raiseAllowed = canRaise(own);
  const min = v.bet + v.minRaise,
    max = v.stacks[v.you]! + v.bets[v.you]!;
  const context = [v.handNumber, v.phase, v.bet, v.minRaise, max].join(':');
  const [raise, setRaise] = useState({ context: '', value: '' });
  const value = raise.context === context ? raise.value : String(min),
    amount = Number(value);
  const validRaise =
    value.trim() !== '' && Number.isInteger(amount) && amount >= min && amount <= max;
  return (
    <div className="th-table">
      <section className="th-felt" aria-label={t('texasHoldemField')}>
        <Seats
          {...v}
          names={names}
          detail={(seat) => (
            <>
              <span>{t('texasHoldemChips', { n: v.stacks[seat]! })}</span>
              <span>
                {v.folded[seat]
                  ? t('texasHoldemFolded')
                  : t('texasHoldemBetAmount', { n: v.bets[seat]! })}
              </span>
              {seat === v.dealer ? (
                <span className="th-marker" aria-label={t('texasHoldemButton')}>
                  D
                </span>
              ) : null}
              {seat === v.smallBlind ? (
                <span className="th-marker" aria-label={t('texasHoldemSmallBlind')}>
                  SB
                </span>
              ) : null}
              {seat === v.bigBlind ? (
                <span className="th-marker" aria-label={t('texasHoldemBigBlind')}>
                  BB
                </span>
              ) : null}
            </>
          )}
        />
        <p className="th-pot">
          {t('texasHoldemPot', {
            n:
              v.phase === 'hand'
                ? v.pots.reduce((n, p) => n + p.amount, 0)
                : v.contributions.reduce((a, b) => a + b, 0),
          })}
        </p>
        <div className="th-center th-community">
          {Array.from({ length: 5 }, (_, i) =>
            v.board[i] !== undefined ? <Face key={i} card={v.board[i]!} /> : <Back key={i} />,
          )}
        </div>
        <p className="th-note">{t(`texasHoldemPhase_${v.phase}`)}</p>
        {v.phase === 'hand' ? <Results view={v} names={names} /> : null}
      </section>
      <section className="th-panel" aria-label={t('texasHoldemHand')}>
        <Status {...v} names={names}>
          {v.phase === 'hand' ? t('texasHoldemHandComplete') : undefined}
        </Status>
        <h2 className="th-heading">
          {t('texasHoldemHand')}
          <small>{t('texasHoldemRound', { n: v.handNumber })}</small>
        </h2>
        <Hand cards={v.hand} />
        {v.hand.length === 2 && v.board.length >= 3 ? (
          <p className="th-note">{t(rankKeys[evaluate([...v.hand, ...v.board]).category]!)}</p>
        ) : null}
        {v.phase === 'hand' ? (
          <>
            {!v.over ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!yours}
                onClick={() => act({ kind: 'next' })}
              >
                {t('texasHoldemNextHand')}
              </button>
            ) : null}
            {!v.over && v.you !== 0 ? (
              <p className="th-note">{t('texasHoldemContinueBy', { name: name(0) })}</p>
            ) : null}
          </>
        ) : (
          <>
            <div className="th-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!yours}
                onClick={() => act({ kind: 'fold' })}
              >
                {t('texasHoldemFold')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!yours}
                onClick={() => act({ kind: call > 0 ? 'call' : 'check' })}
              >
                {call > 0 ? t('texasHoldemCall', { n: call }) : t('texasHoldemCheck')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!yours || !(raiseAllowed || max <= v.bet)}
                onClick={() => act({ kind: 'all-in' })}
              >
                {t('texasHoldemAllIn', { n: v.stacks[v.you]! })}
              </button>
            </div>
            <form
              className="th-raise"
              onSubmit={(e) => {
                e.preventDefault();
                if (yours && raiseAllowed && validRaise) act({ kind: 'raise', to: amount });
              }}
            >
              <label htmlFor="th-raise">{t('texasHoldemRaiseTo')}</label>
              <div className="th-actions">
                <input
                  id="th-raise"
                  inputMode="numeric"
                  type="number"
                  min={min}
                  max={max}
                  step="1"
                  value={value}
                  disabled={!yours || !raiseAllowed || max < min}
                  onChange={(e) => setRaise({ context, value: e.target.value })}
                />
                <button
                  type="submit"
                  className="btn btn-secondary"
                  disabled={!yours || !raiseAllowed || !validRaise}
                >
                  {t('texasHoldemRaise')}
                </button>
              </div>
              <p className="th-note">{t('texasHoldemMinimum', { n: min })}</p>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
export function Results({ view: v, names }: { view: View; names?: readonly string[] }) {
  const { t } = useSettings(),
    name = useTableNames(v.you, names);
  return (
    <div className="th-settlement">
      <dl className="th-score">
        {v.stacks.map((n, seat) => (
          <div key={seat}>
            <dt>{name(seat)}</dt>
            <dd>{t('texasHoldemChips', { n })}</dd>
            {v.payouts[seat]! > 0 ? (
              <dd>{t('texasHoldemAwarded', { n: v.payouts[seat]! })}</dd>
            ) : null}
            {v.returned[seat]! > 0 ? (
              <dd>{t('texasHoldemReturned', { n: v.returned[seat]! })}</dd>
            ) : null}
          </div>
        ))}
      </dl>
      {v.revealed.map((cards, seat) =>
        cards.length ? (
          <div className="th-showdown" key={seat}>
            <strong>{name(seat)}</strong>
            <div className="th-center">
              {cards.map((card) => (
                <Face key={card} card={card} />
              ))}
            </div>
            {v.board.length >= 3 ? (
              <span>{t(rankKeys[evaluate([...cards, ...v.board]).category]!)}</span>
            ) : null}
          </div>
        ) : null,
      )}
      {v.pots.length > 1 ? (
        <ol className="th-pots">
          {v.pots.map((pot, i) => (
            <li key={i}>
              {t(i === 0 ? 'texasHoldemMainPot' : 'texasHoldemSidePot', { n: pot.amount })}
              <ul>
                {pot.winners.map((seat) => (
                  <li key={seat}>{name(seat)}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
