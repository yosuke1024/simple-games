import { useSettings } from '@/state/SettingsContext';
import { HOME_PROGRESS, SEATS, type BySeat, type Seat } from '../../game/types';

export interface LudoPlayersProps {
  pawns: BySeat<BySeat<number>>;
  names: BySeat<string>;
  turn: Seat | null;
  className?: string;
}

/** The same four seats, shape marks and home counts in solo and nearby games. */
export function LudoPlayers({ pawns, names, turn, className = '' }: LudoPlayersProps) {
  const { t } = useSettings();
  return (
    <ul className={`ld-seats ${className}`}>
      {SEATS.map((seat) => {
        const home = pawns[seat].filter((progress) => progress === HOME_PROGRESS).length;
        const active = turn === seat;
        return (
          <li
            key={seat}
            className={`ld-seat-item ld-seat-${seat} ${active ? 'ld-seat-on' : ''}`}
            aria-current={active ? 'true' : undefined}
          >
            <span className={`ld-chip ld-seat-${seat}`} aria-hidden="true">
              <span className="ld-mark" />
            </span>
            <span className="ld-seat-name">{names[seat]}</span>
            <span className="ld-seat-home" aria-label={t('ludoSeatHome', { home })}>
              {home}/4
            </span>
          </li>
        );
      })}
    </ul>
  );
}
