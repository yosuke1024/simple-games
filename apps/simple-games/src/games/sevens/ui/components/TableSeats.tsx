import { useSettings } from '@/state/SettingsContext';
import { type Session } from '../../game';
import { CardBack } from './CardFace';
export function TableSeats({ session }: { session: Session }) {
  const { t } = useSettings();
  return (
    <div className="sv-opponents" aria-label={t('sevensOpponents')}>
      {[1, 2, 3].map((seat) => (
        <div
          key={seat}
          className={`sv-seat ${session.turn === seat && session.status === 'playing' ? 'sv-seat-active' : ''}`}
          aria-current={session.turn === seat ? 'true' : undefined}
        >
          <span className="sv-avatar" aria-hidden="true">
            {['', '◆', '●', '▲'][seat]}
          </span>
          <span className="sv-seat-name">{t('sevensCpu', { n: seat })}</span>
          <span className="sv-seat-cards">
            <span className="sv-mini-back">
              <CardBack />
            </span>
            {t('sevensCards', { n: session.hands[seat]!.length })}
          </span>
        </div>
      ))}
    </div>
  );
}
