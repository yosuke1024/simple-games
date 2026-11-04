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
    <div className="df-opponents" aria-label={t('daifugoOpponents')}>
      {[1, 2, 3].map((seat) => {
        const place = session.order.indexOf(seat as Seat);
        const resting = session.passed.includes(seat as Seat);
        const count = session.hands[seat]!.length;
        const active = activeSeat === seat && session.status === 'playing';
        const backs = Math.min(count, 5);
        return (
          <div
            key={seat}
            className={`df-seat ${active ? 'df-seat-active' : ''} ${place >= 0 || resting ? 'is-resting' : ''} ${source === seat ? 'is-source' : ''}`}
            aria-current={active ? 'true' : undefined}
          >
            <div className="df-seat-fan" aria-hidden="true">
              {Array.from({ length: backs }, (_, i) => (
                <span
                  key={i}
                  className="df-seat-back"
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
              {!count ? <span className="df-seat-finished">✓</span> : null}
            </div>
            <span className="df-seat-name">{t('daifugoCpu', { n: seat })}</span>
            <span className="df-seat-cards">{t('daifugoCards', { n: count })}</span>
            {place >= 0 ? (
              <span className="df-seat-state">{t('daifugoPlaceValue', { n: place + 1 })}</span>
            ) : resting ? (
              <span className="df-seat-state">{t('daifugoPass')}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
