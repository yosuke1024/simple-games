import { useState } from 'react';
import '../../games/daifugo/i18n';
import '../../games/daifugo/ui/daifugo.css';
import { CardFace, cardClass, rankText, SUITS } from '../../games/daifugo/ui/components/CardFace';
import { TableSeats } from '../../games/daifugo/ui/components/TableSeats';
import { beats, legalGroups, sortedHand, rankOf } from '../../games/daifugo/game/index';
import { useSettings } from '../../state/SettingsContext';
import type { GroupBoardProps } from '../groupGames';
import { isDaifugoView } from './daifugo';
export default function DaifugoBoard({
  state,
  seat,
  names,
  canAct,
  act,
  revision,
}: GroupBoardProps) {
  const { t } = useSettings();
  const [choice, setChoice] = useState<{ key: number; cards: number[] }>({ key: -1, cards: [] });
  if (!isDaifugoView(state, seat)) return null;
  const s = state,
    selected = choice.key === revision ? choice.cards : [],
    exchange = s.exchangeCount > 0,
    hand = sortedHand(s.hand, s.revolution),
    possible = new Set(legalGroups(hand, s.table, s.revolution).flat());
  const label = (c: number) =>
    c === 52
      ? t('daifugoJoker')
      : t('daifugoCard', { rank: rankText(c), suit: SUITS[Math.floor(c / 13)]! });
  const select = (c: number) => {
    if (!canAct) return;
    const compatible =
      exchange || c === 52 ? selected : selected.filter((v) => v === 52 || rankOf(v) === rankOf(c));
    setChoice({
      key: revision,
      cards: selected.includes(c) ? selected.filter((v) => v !== c) : [...compatible, c],
    });
  };
  return (
    <div className="df-body">
      <div className="df-arena">
        <TableSeats
          session={{
            ...s,
            status: s.over ? 'finished' : 'playing',
            hands: s.counts.map((length) => ({ length })),
          }}
          names={names}
          perspective={seat}
        />
        <section className="df-table" aria-label={t('daifugoField')}>
          <p className="df-table-label">
            {exchange ? t('daifugoExchangeCount', { n: s.exchangeCount }) : t('daifugoTable')}
          </p>
          <div className="df-table-cards">
            {s.table.map((c) => (
              <span className={cardClass(c)} key={c} role="img" aria-label={label(c)}>
                <CardFace card={c} />
              </span>
            ))}
          </div>
          <span className="df-badge">{t(s.revolution ? 'daifugoReversed' : 'daifugoNormal')}</span>
        </section>
      </div>
      <p className="df-status" role="status">
        {canAct ? t('daifugoYourTurn') : t('daifugoTurn', { name: names[s.turn]! })}
      </p>
      <div className="df-hand-heading">
        <strong>{t('daifugoHand')}</strong>
        <span>{t('daifugoSelected', { n: selected.length })}</span>
      </div>
      <div className="df-hand">
        {hand.map((c) => (
          <button
            key={c}
            className={`${cardClass(c)} ${selected.includes(c) ? 'is-selected' : ''} ${possible.has(c) ? 'is-legal' : ''}`}
            aria-label={label(c)}
            aria-pressed={selected.includes(c)}
            disabled={!canAct || (!exchange && !possible.has(c))}
            onClick={() => select(c)}
          >
            <CardFace card={c} />
          </button>
        ))}
      </div>
      <div className="df-controls">
        <button
          className="btn btn-primary"
          disabled={
            !canAct ||
            (exchange
              ? selected.length !== s.exchangeCount
              : !beats(selected, s.table, s.revolution))
          }
          onClick={() => act({ kind: exchange ? 'exchange' : 'play', cards: selected })}
        >
          {t(exchange ? 'daifugoExchange' : 'daifugoPlay')}
        </button>
        {!exchange ? (
          <button
            className="btn btn-secondary"
            disabled={!canAct || !s.table.length}
            onClick={() => act({ kind: 'pass' })}
          >
            {t('daifugoPass')}
          </button>
        ) : null}
      </div>
      {s.order.includes(seat) ? (
        <p>{t('daifugoPlaceValue', { n: s.order.indexOf(seat) + 1 })}</p>
      ) : null}
    </div>
  );
}
export { game } from './daifugo';
