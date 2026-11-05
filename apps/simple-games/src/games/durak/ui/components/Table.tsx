import { useSettings } from '@/state/SettingsContext';
import { legalCards, suitOf, type Action } from '../../game';
import type { View } from '../../game/view';
import { SUITS } from './CardFace';
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
  const { t } = useSettings();
  const yours = canAct && !v.over && v.turn === v.you,
    attacking = v.attacker === v.you;
  const done = v.table.length > 0 && (v.taking || v.table.every((p) => p.defense !== null));
  return (
    <div className="du-table">
      <section className="du-felt" aria-label={t('durakField')}>
        <Seats {...v} names={names} />
        <div className="du-trump">
          <span>{t('durakTrump', { suit: SUITS[suitOf(v.trump)]! })}</span>
          {v.stockCount > 0 ? (
            <span className="du-trump-card">
              <Face card={v.trump} />
            </span>
          ) : null}
          <span>{t('durakStockCount', { n: v.stockCount })}</span>
        </div>
        <div className="du-center">
          {v.table.map((pair, i) => (
            <div className="du-pair" key={i}>
              <Face card={pair.attack} />
              {pair.defense !== null ? <Face card={pair.defense} /> : null}
            </div>
          ))}
        </div>
        {v.over ? <Results view={v} names={names} /> : null}
      </section>
      <section className="du-panel" aria-label={t('durakHand')}>
        <Status {...v} names={names} />
        <p className="du-note">
          {t(v.taking ? 'durakTaking' : attacking ? 'durakAttackHint' : 'durakDefendHint')}
        </p>
        <h2 className="du-heading">
          {t('durakHand')}
          <small>{t('durakCards', { n: v.hand.length })}</small>
        </h2>
        <Hand
          cards={[...v.hand].sort((a, b) => a - b)}
          enabled={yours ? legalCards(v) : []}
          onChoose={(card) => act({ kind: attacking ? 'attack' : 'defend', card })}
        />
        <div className="du-actions">
          {attacking ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!yours || !done}
              onClick={() => act({ kind: 'done' })}
            >
              {t(v.taking ? 'durakConfirmTake' : 'durakDone')}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!yours}
              onClick={() => act({ kind: 'take' })}
            >
              {t('durakTake')}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
export function Results({ view: v, names }: { view: View; names?: readonly string[] }) {
  const { t } = useSettings(),
    name = useTableNames(v.you, names);
  return (
    <dl className="du-score">
      {v.counts.map((n, seat) => (
        <div key={seat}>
          <dt>{name(seat)}</dt>
          <dd>{t('durakCards', { n })}</dd>
        </div>
      ))}
    </dl>
  );
}
