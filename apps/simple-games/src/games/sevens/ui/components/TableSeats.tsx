import type { CSSProperties } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { type Seat } from '../../game';
import { CardBack } from './CardFace';
export function TableSeats({
  session,
  source,
  names,
  perspective = 0,
  activeSeat = session.turn,
}: {
  session: {
    turn: number;
    status: string;
    hands: readonly { length: number }[];
    finished: readonly number[];
    eliminated: readonly number[];
    passes: readonly number[];
  };
  names?: readonly string[];
  perspective?: number;
  source?: number;
  activeSeat?: number;
}) {
  const { t } = useSettings();
  return (
    <div className="sv-opponents" aria-label={t('sevensOpponents')}>
      {[1, 2, 3]
        .map((offset) => (offset + perspective) % 4)
        .map((seat) => {
          const place = session.finished.indexOf(seat as Seat);
          const resting = session.eliminated.includes(seat as Seat);
          const count = session.hands[seat]!.length;
          const active = activeSeat === seat && session.status === 'playing';
          const backs = Math.min(count, 5);
          return (
            <div
              key={seat}
              className={`sv-seat ${active ? 'sv-seat-active' : ''} ${place >= 0 || resting ? 'is-resting' : ''} ${source === seat ? 'is-source' : ''}`}
              aria-current={active ? 'true' : undefined}
            >
              <div className="sv-seat-fan" aria-hidden="true">
                {Array.from({ length: backs }, (_, i) => (
                  <span
                    key={i}
                    className="sv-seat-back"
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
                {!count ? <span className="sv-seat-finished">{resting ? '×' : '✓'}</span> : null}
              </div>
              <span className="sv-seat-name">{names?.[seat] ?? t('sevensCpu', { n: seat })}</span>
              <span className="sv-seat-cards">{t('sevensCards', { n: count })}</span>
              {place >= 0 ? (
                <span className="sv-seat-state">{t('sevensPlaceValue', { n: place + 1 })}</span>
              ) : resting ? (
                <span
                  className="sv-seat-state"
                  role="img"
                  aria-label={t('sevensEvent_out', {
                    name: names?.[seat] ?? t('sevensCpu', { n: seat }),
                  })}
                >
                  ×
                </span>
              ) : (
                <span
                  className="sv-seat-passes"
                  role="img"
                  aria-label={t('sevensPasses', { n: Math.max(0, 3 - session.passes[seat]!) })}
                >
                  {[0, 1, 2].map((i) => (
                    <i key={i} className={i < 3 - session.passes[seat]! ? 'is-available' : ''} />
                  ))}
                </span>
              )}
            </div>
          );
        })}
    </div>
  );
}
