import { useSettings } from '@/state/SettingsContext';
import {
  canDouble,
  canSplit,
  natural,
  total,
  type Action,
  type Hand as BlackjackHand,
} from '../../game';
import type { View } from '../../game/view';
import { Back, Face, Hand, Seats, Status, useTableNames } from './TableParts';
function HandTotal({ hand }: { hand: BlackjackHand }) {
  const { t } = useSettings(),
    n = total(hand.cards);
  return (
    <span>
      {natural(hand)
        ? t('blackjackNatural')
        : n.value > 21
          ? t('blackjackBust')
          : t(n.soft ? 'blackjackSoftTotal' : 'blackjackTotal', { n: n.value })}
    </span>
  );
}
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
  const { t } = useSettings();
  const yours = canAct && !v.over && v.turn === v.you;
  const hand = v.hands[v.handIndex],
    own = hand ? { hand, handCount: v.hands.length, upcard: v.dealer[0]! } : null;
  return (
    <div className="bj-table">
      <section className="bj-felt" aria-label={t('blackjackField')}>
        <Seats {...v} names={names} />
        <h2 className="bj-heading">{t('blackjackDealer')}</h2>
        <div className="bj-center">
          {v.dealer.map((card) => (
            <Face key={card} card={card} />
          ))}
          {!v.over ? <Back /> : null}
        </div>
        <p className="bj-note">
          {v.over ? t('blackjackTotal', { n: total(v.dealer).value }) : t('blackjackDealerRule')}
        </p>
        {v.over ? <Results view={v} names={names} /> : null}
      </section>
      <section className="bj-panel" aria-label={t('blackjackHand')}>
        <Status {...v} names={names} />
        {v.hands.map((h, i) => (
          <div
            className={`bj-player-hand ${!v.over && v.turn === v.you && v.handIndex === i ? 'is-active' : ''}`}
            key={i}
          >
            <h2 className="bj-heading">
              {t('blackjackHandNumber', { n: i + 1 })}
              <small>
                <HandTotal hand={h} />
              </small>
            </h2>
            <Hand cards={h.cards} />
            <p className="bj-note">
              {h.payout !== null
                ? t('blackjackNet', { n: h.payout })
                : t('blackjackStake', { n: h.stake })}
            </p>
          </div>
        ))}
        <div className="bj-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!yours}
            onClick={() => act({ kind: 'hit' })}
          >
            {t('blackjackHit')}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!yours}
            onClick={() => act({ kind: 'stand' })}
          >
            {t('blackjackStand')}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!yours || !own || !canDouble(own)}
            onClick={() => act({ kind: 'double' })}
          >
            {t('blackjackDouble')}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!yours || !own || !canSplit(own)}
            onClick={() => act({ kind: 'split' })}
          >
            {t('blackjackSplit')}
          </button>
        </div>
        <p className="bj-note">{t('blackjackActionsHint')}</p>
      </section>
    </div>
  );
}
export function Results({ view: v, names }: { view: View; names?: readonly string[] }) {
  const { t } = useSettings(),
    name = useTableNames(v.you, names);
  return (
    <div className="bj-settlement">
      <p className="bj-note">{t('blackjackDealerTotal', { n: total(v.dealer).value })}</p>
      {v.revealed.map((hands, seat) => (
        <div className="bj-result-seat" key={seat}>
          <strong>{name(seat)}</strong>
          <span>{t('blackjackNet', { n: v.scores[seat]! })}</span>
          {hands.map((h, i) => (
            <div className="bj-result-hand" key={i}>
              <div className="bj-center">
                {h.cards.map((card) => (
                  <Face card={card} key={card} />
                ))}
              </div>
              <HandTotal hand={h} />
              <span>{t('blackjackNet', { n: h.payout ?? 0 })}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
