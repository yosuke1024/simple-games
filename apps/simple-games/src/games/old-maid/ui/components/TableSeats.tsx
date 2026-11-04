import type { CSSProperties } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { type Session, type Seat } from '../../game';
import { CardBack } from './CardFace';
export function TableSeats({
  session,
  source,
  activeSeat = session.turn,
}: {
  session: Session;
  source?: number;
  activeSeat?: number;
}) {
  const { t } = useSettings();
  return (
    <div className="om-opponents" aria-label={t('oldMaidOpponents')}>
      {[1, 2, 3].map((seat) => {
        const place = session.order.indexOf(seat as Seat);
        const resting = false;
        const count = session.hands[seat]!.length;
        const active = activeSeat === seat && session.status === 'playing';
        const backs = Math.min(count, 5);
        return (
          <div
            key={seat}
            className={`om-seat ${active ? 'om-seat-active' : ''} ${place >= 0 || resting ? 'is-resting' : ''} ${source === seat ? 'is-source' : ''}`}
            aria-current={active ? 'true' : undefined}
          >
            <div className="om-seat-fan" aria-hidden="true">
              {Array.from({ length: backs }, (_, i) => (
                <span
                  key={i}
                  className="om-seat-back"
                  style={
                    {
                      '--fan-x': `${(i - (backs - 1) / 2) * 10}px`,
                      '--fan-angle': `${(i - (backs - 1) / 2) * 12}deg`,
                    } as CSSProperties
                  }
                >
                  <CardBack />
                </span>
              ))}
              {!count ? <span className="om-seat-finished">✓</span> : null}
            </div>
            <span className="om-seat-name">{t('oldMaidCpu', { n: seat })}</span>
            <span className="om-seat-cards">{t('oldMaidCards', { n: count })}</span>
            {place >= 0 ? (
              <span className="om-seat-state">{t('oldMaidPlaceValue', { n: place + 1 })}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
