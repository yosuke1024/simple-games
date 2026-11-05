import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { legalCards, rankOf, type Action } from '../../game';
import type { View } from '../../game/view';
import { SUITS } from './CardFace';
import { Back, Face, Hand, Seats, Status, useTableNames } from './TableParts';
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
  const [eight, setEight] = useState<number | null>(null);
  const yours = canAct && !v.over && v.turn === v.you;
  const legal = legalCards(v);
  const selected = eight !== null && v.hand.includes(eight) ? eight : null;
  return (
    <div className="ce-table">
      <section className="ce-felt" aria-label={t('crazyEightsField')}>
        <Seats {...v} names={names} />
        <div className="ce-center">
          <div className="ce-pile">
            <Back />
            <span>{t('crazyEightsStock')}</span>
          </div>
          <div className="ce-pile">
            <Face card={v.top} />
            <span>{t('crazyEightsSuit', { suit: SUITS[v.suit]! })}</span>
          </div>
        </div>
        {v.over ? <Results view={v} names={names} /> : null}
      </section>
      <section className="ce-panel" aria-label={t('crazyEightsHand')}>
        <Status {...v} names={names} />
        <h2 className="ce-heading">
          {t('crazyEightsHand')}
          <small>{t('crazyEightsCards', { n: v.hand.length })}</small>
        </h2>
        <Hand
          cards={[...v.hand].sort((a, b) => a - b)}
          enabled={yours ? legal : []}
          selected={selected}
          onChoose={(card) => {
            if (rankOf(card) === 8) setEight(card);
            else {
              setEight(null);
              act({ kind: 'play', card });
            }
          }}
        />
        {selected !== null ? (
          <div className="ce-choice">
            <p className="ce-note">{t('crazyEightsChooseSuit')}</p>
            <div className="ce-actions">
              {SUITS.map((suit, n) => (
                <button
                  type="button"
                  className="btn btn-secondary"
                  key={suit}
                  disabled={!yours}
                  aria-label={t('crazyEightsSuit', { suit })}
                  onClick={() => {
                    act({ kind: 'play', card: selected, suit: n });
                    setEight(null);
                  }}
                >
                  {suit}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="ce-note">{t('crazyEightsMatch')}</p>
        )}
        <div className="ce-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!yours || !v.drawable}
            onClick={() => {
              setEight(null);
              act({ kind: 'draw' });
            }}
          >
            {t('crazyEightsDrawCard')}
          </button>
          {!v.drawable && !legal.length ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!yours}
              onClick={() => act({ kind: 'pass' })}
            >
              {t('crazyEightsPass')}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
export function Results({ view: v, names }: { view: View; names?: readonly string[] }) {
  const { t } = useSettings(),
    name = useTableNames(v.you, names);
  return (
    <div>
      <p className="ce-note">{t('crazyEightsPenalty')}</p>
      <dl className="ce-score">
        {v.penalties.map((n, seat) => (
          <div key={seat}>
            <dt>{name(seat)}</dt>
            <dd>{n}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
