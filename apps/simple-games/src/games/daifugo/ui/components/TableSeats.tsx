import { useSettings } from '@/state/SettingsContext';
import { type Session } from '../../game';
import { CardBack } from './CardFace';
export function TableSeats({ session }: { session: Session }) {
  const { t } = useSettings();
  return (
    <div className="df-opponents" aria-label={t('daifugoOpponents')}>
      {[1, 2, 3].map((seat) => (
        <div
          key={seat}
          className={`df-seat ${session.turn === seat && session.status === 'playing' ? 'df-seat-active' : ''}`}
          aria-current={session.turn === seat ? 'true' : undefined}
        >
          <span className="df-avatar" aria-hidden="true">
            {['', '◆', '●', '▲'][seat]}
          </span>
          <span className="df-seat-name">{t('daifugoCpu', { n: seat })}</span>
          <span className="df-seat-cards">
            <span className="df-mini-back">
              <CardBack />
            </span>
            {t('daifugoCards', { n: session.hands[seat]!.length })}
          </span>
        </div>
      ))}
    </div>
  );
}
