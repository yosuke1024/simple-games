import type { CSSProperties } from 'react';
import '../../games/old-maid/i18n';
import '../../games/old-maid/ui/old-maid.css';
import {
  CardFace,
  CardBack,
  cardClass,
  rankText,
  SUITS,
} from '../../games/old-maid/ui/components/CardFace';
import { TableSeats } from '../../games/old-maid/ui/components/TableSeats';
import { useSettings } from '../../state/SettingsContext';
import type { GroupBoardProps } from '../groupGames';
import { isOldMaidView } from './old-maid';
export default function OldMaidBoard({ state, seat, names, canAct, act }: GroupBoardProps) {
  const { t } = useSettings();
  if (!isOldMaidView(state, seat)) return null;
  const s = state,
    count = s.counts[s.source]!;
  const label = (c: number) =>
    c === 52
      ? t('oldMaidJoker')
      : t('oldMaidCard', { rank: rankText(c), suit: SUITS[Math.floor(c / 13)]! });
  return (
    <div className="om-body">
      <div className="om-arena">
        <TableSeats
          session={{
            ...s,
            status: s.over ? 'finished' : 'playing',
            hands: s.counts.map((length) => ({ length })),
          }}
          names={names}
          perspective={seat}
          source={s.source}
        />
        <section className="om-table om-draw-table" aria-label={t('oldMaidField')}>
          <p className="om-table-label">{t('oldMaidDrawFrom', { name: names[s.source]! })}</p>
          <div
            className="om-draw-hand"
            style={{ '--draw-columns': Math.max(1, Math.min(7, count)) } as CSSProperties}
          >
            {Array.from({ length: count }, (_, i) => (
              <button
                key={i}
                className="om-card"
                disabled={!canAct}
                aria-label={t('oldMaidHiddenCard', { n: i + 1, total: count })}
                onClick={() => act({ kind: 'draw', index: i })}
              >
                <CardBack />
              </button>
            ))}
          </div>
          <div className="om-pair-preview">
            {s.event.cards.map((c) => (
              <span key={c} className={cardClass(c)} role="img" aria-label={label(c)}>
                <CardFace card={c} />
              </span>
            ))}
          </div>
        </section>
      </div>
      <p className="om-status" role="status">
        {canAct ? t('oldMaidYourTurn') : t('oldMaidTurn', { name: names[s.turn]! })}
      </p>
      <div className="om-hand">
        {[...s.hand]
          .sort((a, b) => a - b)
          .map((c) => (
            <span key={c} className={cardClass(c)} role="img" aria-label={label(c)}>
              <CardFace card={c} />
            </span>
          ))}
      </div>
      {s.order.includes(seat) ? (
        <p>{t('oldMaidPlaceValue', { n: s.order.indexOf(seat) + 1 })}</p>
      ) : null}
    </div>
  );
}
export { game } from './old-maid';
