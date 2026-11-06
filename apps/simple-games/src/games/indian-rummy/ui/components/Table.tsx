import { useMemo, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { analyze, isWild, type Action, type Card } from '../../game';
import { arrangeHand, sameOrder, sortHand } from '../../game/handOrder';
import type { View } from '../../game/view';
import { rankText } from './CardFace';
import { Back, Face, Hand, Seats, Status, useTableNames } from './TableParts';
/**
 * Where the player's arrangement lives (docs/INDIAN_RUMMY_RULES.md, "Hand
 * arrangement"): with the saved game for the CPU table. Without one — a Nearby
 * board — the table keeps it itself, on this device, for as long as it is shown.
 */
export interface Arrangement {
  order: readonly Card[];
  onArrange: (order: readonly Card[]) => void;
}
export function Table({
  view: v,
  canAct,
  act,
  names,
  arrangement,
}: {
  view: View;
  canAct: boolean;
  act: (action: Action) => void;
  names?: readonly string[];
  arrangement?: Arrangement;
}) {
  const { t } = useSettings(),
    [selected, setSelected] = useState<number | null>(null);
  // The table's own arrangement follows the hand as it changes, the way the
  // saved one does in the game context: a draw joins at the right end. A Nearby
  // board stays mounted from one deal to the next, so the table marks the deal
  // boundary itself rather than guess it from how many cards two hands share: a
  // finished deal followed by a live one, the deal event, or a new wild
  // indicator (drawn once per deal) starts the hand sorted again.
  const handKey = v.hand.join(','),
    mark = { key: handKey, over: v.over, indicator: v.indicator };
  const [own, setOwn] = useState(() => ({ ...mark, order: sortHand(v.hand) }));
  let ownOrder = own.order;
  if (
    !arrangement &&
    (own.key !== handKey || own.over !== v.over || own.indicator !== v.indicator)
  ) {
    const newDeal =
      (own.over && !v.over) ||
      own.indicator !== v.indicator ||
      (own.key !== handKey && v.event.kind === 'deal');
    ownOrder = newDeal ? sortHand(v.hand) : arrangeHand(own.order, v.hand);
    setOwn({ ...mark, order: ownOrder });
  }
  const hand = arrangeHand(arrangement?.order ?? ownOrder, v.hand),
    sorted = sortHand(v.hand);
  const arrange = (order: readonly Card[]) => {
    if (arrangement) arrangement.onArrange(order);
    else setOwn({ ...mark, order: arrangeHand(order, v.hand) });
  };
  const yours = canAct && !v.over && v.turn === v.you;
  const choice =
    selected !== null && v.hand.includes(selected) && selected !== v.picked && v.phase === 'discard'
      ? selected
      : null;
  // Only the local hand enters the analysis. Stable scalar dependencies avoid redoing
  // the meld search on elapsed-time ticks or other players' public moves.
  const cards = v.hand.filter((card) => card !== choice).join(','),
    wild = v.wildRank;
  const analysis = useMemo(
    () => analyze(cards.split(',').filter(Boolean).map(Number), wild),
    [cards, wild],
  );
  const drawStock = v.stockCount > 0 || v.discardCount > 1,
    drawDiscard = v.top !== null && !isWild(v.top, v.wildRank);
  return (
    <div className="ir-table">
      <section className="ir-felt" aria-label={t('indianRummyField')}>
        <Seats {...v} names={names} />
        <div className="ir-center">
          <div className="ir-pile">
            <Face card={v.indicator} />
            <span>{t('indianRummyWild', { rank: rankText(v.wildRank - 1) })}</span>
          </div>
          <div className="ir-pile">
            <Back />
            <span>{t('indianRummyStock')}</span>
          </div>
          <div className="ir-pile">
            {v.top !== null ? <Face card={v.top} /> : <span className="ir-empty" />}
            <span>{t('indianRummyDiscardPile')}</span>
          </div>
        </div>
        {v.over ? <Results view={v} names={names} /> : null}
      </section>
      <section className="ir-panel" aria-label={t('indianRummyHand')}>
        <Status {...v} names={names} />
        <p className="ir-note">
          {t(v.phase === 'draw' ? 'indianRummyDrawHint' : 'indianRummyDiscardHint')}
        </p>
        <div className="ir-hand-head">
          <h2 className="ir-heading">
            {t('indianRummyHand')}
            <small>{t('indianRummyCards', { n: v.hand.length })}</small>
          </h2>
          {v.over ? null : (
            <button
              type="button"
              className="ir-sort"
              disabled={sameOrder(hand, sorted)}
              onClick={() => arrange(sorted)}
            >
              {t('indianRummySort')}
            </button>
          )}
        </div>
        <Hand
          cards={hand}
          selected={choice}
          enabled={yours && v.phase === 'discard' ? v.hand.filter((card) => card !== v.picked) : []}
          onChoose={setSelected}
          onArrange={v.over ? undefined : arrange}
        />
        <div className="ir-actions">
          {v.phase === 'draw' ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!yours || !drawStock}
                onClick={() => {
                  setSelected(null);
                  act({ kind: 'draw', source: 'stock' });
                }}
              >
                {t('indianRummyDrawStock')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!yours || !drawDiscard}
                onClick={() => {
                  setSelected(null);
                  act({ kind: 'draw', source: 'discard' });
                }}
              >
                {t('indianRummyDrawDiscard')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!yours || choice === null}
                onClick={() => {
                  if (choice !== null) {
                    act({ kind: 'discard', card: choice });
                    setSelected(null);
                  }
                }}
              >
                {t('indianRummyDiscard')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!yours || choice === null || !analysis.complete}
                aria-describedby="ir-declare-note"
                onClick={() => {
                  if (choice !== null) {
                    act({ kind: 'declare', card: choice });
                    setSelected(null);
                  }
                }}
              >
                {t('indianRummyDeclare')}
              </button>
            </>
          )}
        </div>
        <p className="ir-note" id="ir-declare-note">
          {t(choice !== null && analysis.complete ? 'indianRummyReady' : 'indianRummyRequirement')}
        </p>
        <details className="ir-analysis">
          <summary>{t('indianRummyGroups')}</summary>
          {analysis.groups.map((group, i) => (
            <div className="ir-group" key={i}>
              <strong>{t(`indianRummyMeld_${group.kind}`)}</strong>
              <Hand cards={group.cards} />
            </div>
          ))}
          {analysis.unmatched.length ? (
            <div className="ir-group">
              <strong>{t('indianRummyUnmatched')}</strong>
              <Hand cards={analysis.unmatched} />
            </div>
          ) : null}
        </details>
      </section>
    </div>
  );
}
export function Results({ view: v, names }: { view: View; names?: readonly string[] }) {
  const { t } = useSettings(),
    name = useTableNames(v.you, names);
  return (
    <div>
      <p className="ir-note">{t('indianRummyPenalty')}</p>
      <dl className="ir-score">
        {v.penalties.map((n, seat) => (
          <div key={seat}>
            <dt>{name(seat)}</dt>
            <dd>{n}</dd>
          </div>
        ))}
      </dl>
      {v.declaration.map((group, i) => (
        <div className="ir-group" key={i}>
          <strong>{t(`indianRummyMeld_${group.kind}`)}</strong>
          <Hand cards={group.cards} />
        </div>
      ))}
    </div>
  );
}
