/**
 * The same playing surface for the CPU game and a nearby human opponent.
 * Only presentation and input callbacks live here: no game provider, saved
 * solo match, statistics, CPU timer, Club action, or network connection.
 */
import '../../i18n';
import '../yacht.css';
import { useSettings } from '@/state/SettingsContext';
import { ROLLS_PER_TURN } from '../../game/types';
import { YachtDice, type DiceRoll } from './YachtDice';
import { YachtSheet, type YachtSheetProps } from './YachtSheet';

export type { DiceRoll } from './YachtDice';
export type { SheetFlash } from './YachtSheet';

export interface YachtPlaySurfaceProps extends YachtSheetProps {
  held: readonly boolean[];
  rollsUsed: number;
  canHold: boolean;
  canRoll: boolean;
  lastRoll: DiceRoll | null;
  onRoll: () => void;
  onToggle: (index: number) => void;
  /** A remote turn, receiver acknowledgment, or suspended connection. */
  waitingLabel?: string;
  showRoll?: boolean;
}

export function YachtPlaySurface({
  held,
  rollsUsed,
  canHold,
  canRoll,
  lastRoll,
  onRoll,
  onToggle,
  waitingLabel,
  showRoll,
  ...sheet
}: YachtPlaySurfaceProps) {
  const { t } = useSettings();
  return (
    <div className="yt-body">
      <YachtDice
        dice={sheet.dice}
        held={held}
        rolled={sheet.rolled}
        canHold={canHold}
        lastRoll={lastRoll}
        onToggle={onToggle}
      />
      {(showRoll ?? sheet.playing) ? (
        <button
          type="button"
          className="btn btn-primary yt-roll"
          onClick={onRoll}
          disabled={!canRoll}
        >
          {t('yachtRoll')}
          <span className="btn-note">{t('yachtRollsLeft', { n: ROLLS_PER_TURN - rollsUsed })}</span>
        </button>
      ) : (
        <button type="button" className="btn btn-primary yt-roll" disabled>
          {waitingLabel ?? t('yachtCpuTurn')}
        </button>
      )}
      <YachtSheet {...sheet} />
    </div>
  );
}
