import { useSettings } from '@/state/SettingsContext';
import { type Session } from '../../game';
import { CardBack } from './CardFace';
export function TableSeats({ session }: { session: Session }) {
  const { t } = useSettings();
  return (
    <div className="om-opponents" aria-label={t('oldMaidOpponents')}>
      {[1, 2, 3].map((seat) => (
        <div
          key={seat}
          className={`om-seat ${session.turn === seat && session.status === 'playing' ? 'om-seat-active' : ''}`}
          aria-current={session.turn === seat ? 'true' : undefined}
        >
          <span className="om-avatar" aria-hidden="true">
            {['', '◆', '●', '▲'][seat]}
          </span>
          <span className="om-seat-name">{t('oldMaidCpu', { n: seat })}</span>
          <span className="om-seat-cards">
            <span className="om-mini-back">
              <CardBack />
            </span>
            {t('oldMaidCards', { n: session.hands[seat]!.length })}
          </span>
        </div>
      ))}
    </div>
  );
}
