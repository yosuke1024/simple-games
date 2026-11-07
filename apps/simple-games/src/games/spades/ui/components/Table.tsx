import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { legalCards, type Action } from '../../game';
import type { View } from '../../game/view';
import { Face, Hand, Seats, Status, useTableNames } from './TableParts';
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
    name = useTableNames(v.you, names),
    [bid, setBid] = useState(3);
  const yours = canAct && !v.over && v.turn === v.you,
    trick = v.trick.length ? v.trick : v.lastTrick;
  return (
    <div className="sa-table">
      <section className="sa-felt" aria-label={t('spadesField')}>
        <Seats
          {...v}
          names={names}
          detail={(seat) => (
            <span>
              {t('spadesBidTricks', {
                bid: v.bids[seat] === -1 ? '—' : v.bids[seat]!,
                n: v.tricks[seat]!,
              })}
            </span>
          )}
        />
        <p className="sa-note">
          {t('spadesTeams', { first: name(0), second: name(2), third: name(1), fourth: name(3) })}
        </p>
        <div className={`sa-center ${trick.length ? '' : 'is-empty'}`}>
          {trick.map((p) => (
            <div className="sa-pile" key={p.seat}>
              <Face card={p.card} />
              <span>{name(p.seat)}</span>
            </div>
          ))}
        </div>
        {v.lastTrick.length && !v.trick.length ? (
          <p className="sa-note">{t('spadesLastTrick')}</p>
        ) : null}
        <Results view={v} names={names} />
      </section>
      <section className="sa-panel" aria-label={t('spadesHand')}>
        <Status {...v} names={names}>
          {v.phase === 'hand' ? t('spadesHandComplete') : undefined}
        </Status>
        <h2 className="sa-heading">
          {t('spadesHand')}
          <small>{t('spadesRound', { n: v.handNumber })}</small>
        </h2>
        <Hand
          cards={[...v.hand].sort((a, b) => a - b)}
          enabled={yours && v.phase === 'play' ? legalCards(v.hand, v.trick, v.broken) : []}
          onChoose={(card) => act({ kind: 'play', card })}
        />
        {v.phase === 'bid' ? (
          <div className="sa-bidding">
            <label htmlFor="sa-bid">{t('spadesBid')}</label>
            <div className="sa-actions">
              <select
                id="sa-bid"
                value={bid}
                disabled={!yours}
                onChange={(e) => setBid(Number(e.target.value))}
              >
                {Array.from({ length: 14 }, (_, n) => (
                  <option key={n} value={n}>
                    {n === 0 ? t('spadesNil') : n}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!yours}
                onClick={() => act({ kind: 'bid', bid })}
              >
                {t('spadesBid')}
              </button>
            </div>
            <p className="sa-note">{t('spadesNilHint')}</p>
          </div>
        ) : v.phase === 'hand' ? (
          <>
            {v.lastScore ? (
              <dl className="sa-score">
                {v.lastScore.delta.map((n, team) => (
                  <div key={team}>
                    <dt>{t('spadesTeam', { n: team + 1 })}</dt>
                    <dd>{n > 0 ? `+${n}` : n}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {!v.over ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!yours}
                onClick={() => act({ kind: 'next' })}
              >
                {t('spadesNextHand')}
              </button>
            ) : null}
            {!v.over && v.you !== 0 ? (
              <p className="sa-note">{t('spadesContinueBy', { name: name(0) })}</p>
            ) : null}
          </>
        ) : (
          <p className="sa-note">{t(v.broken ? 'spadesFollow' : 'spadesUnbroken')}</p>
        )}
      </section>
    </div>
  );
}
export function Results({ view: v, names }: { view: View; names?: readonly string[] }) {
  const { t } = useSettings(),
    name = useTableNames(v.you, names);
  return (
    <div>
      <p className="sa-note">{t('spadesTarget')}</p>
      <dl className="sa-score">
        {v.scores.map((n, team) => (
          <div key={team}>
            <dt>{t('spadesPartners', { first: name(team), second: name(team + 2) })}</dt>
            <dd>{n}</dd>
            <dd>{t('spadesBags', { n: v.bags[team]! })}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
