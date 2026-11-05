import { useState } from 'react';
import '../../games/sevens/i18n';
import '../../games/sevens/ui/sevens.css';
import { CardFace, cardClass, rankText, SUITS } from '../../games/sevens/ui/components/CardFace';
import { TableSeats } from '../../games/sevens/ui/components/TableSeats';
import { SevensGrid } from '../../games/sevens/ui/components/SevensGrid';
import { canPlay } from '../../games/sevens/game/index';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog';
import { useSettings } from '../../state/SettingsContext';
import type { GroupBoardProps } from '../groupGames';
import { isSevensView } from './sevens';
export default function SevensBoard({
  state,
  seat,
  names,
  canAct,
  act,
  visible,
  revision,
}: GroupBoardProps) {
  const { t } = useSettings();
  const [confirmRevision, setConfirmRevision] = useState<number | null>(null);
  const confirm = confirmRevision === revision && canAct;
  const setConfirm = (open: boolean) => setConfirmRevision(open ? revision : null);
  if (!isSevensView(state, seat)) return null;
  const s = state;
  const label = (c: number) =>
    t('sevensCard', { rank: rankText(c), suit: SUITS[Math.floor(c / 13)]! });
  return (
    <>
      <div className="sv-body" inert={confirm}>
        <div className="sv-arena">
          <TableSeats
            session={{
              ...s,
              status: s.over ? 'finished' : 'playing',
              hands: s.counts.map((length) => ({ length })),
            }}
            names={names}
            perspective={seat}
          />
          <section className="sv-table sv-sevens-table" aria-label={t('sevensField')}>
            <SevensGrid
              hand={s.hand}
              table={s.table}
              lastCards={s.event.cards}
              blocked={!canAct || confirm}
              onPlay={(card) => act({ kind: 'play', card })}
            />
          </section>
        </div>
        <p className="sv-status" role="status">
          {canAct ? t('sevensYourTurn') : t('sevensTurn', { name: names[s.turn]! })}
        </p>
        <div className="sv-hand">
          {[...s.hand]
            .sort((a, b) => a - b)
            .map((c) => (
              <button
                key={c}
                className={`${cardClass(c)} ${canPlay(c, s.table) ? 'is-legal' : 'is-unplayable'}`}
                aria-label={label(c)}
                disabled={!canAct || confirm || !canPlay(c, s.table)}
                onClick={() => act({ kind: 'play', card: c })}
              >
                <CardFace card={c} />
              </button>
            ))}
        </div>
        <div className="sv-controls">
          <span>{t('sevensPasses', { n: Math.max(0, 3 - s.passes[seat]!) })}</span>
          <button
            className="btn btn-secondary"
            disabled={!canAct}
            onClick={() => (s.passes[seat] === 3 ? setConfirm(true) : act({ kind: 'pass' }))}
          >
            {t('sevensPass')}
          </button>
        </div>
        {s.order.includes(seat) ? (
          <p>{t('sevensPlaceValue', { n: s.order.indexOf(seat) + 1 })}</p>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirm && visible}
        title={t('sevensPassOutTitle')}
        body={t('sevensPassOutBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('sevensPass')}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          if (canAct) act({ kind: 'pass' });
        }}
      />
    </>
  );
}
export { game } from './sevens';
