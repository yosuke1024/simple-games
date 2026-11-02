/**
 * The one thing this game has to say at the end (docs/BACKGAMMON_RULES.md
 * §3, §8): who bore off first, what each side had off, and — as a fact, never
 * a multiplier — whether it was a gammon or a backgammon. The standing record
 * against this opponent is mentioned once, quietly. A loss is stated, never
 * scolded; there is no revival to buy and no ad to watch (ADS_POLICY.md).
 */
import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import type { BackgammonSession } from '../../game/session';
import type { Stats } from '../../storage/schemas';

export interface BackgammonResultOverlayProps {
  session: BackgammonSession;
  stats: Stats;
  onRematch: () => void;
  onHome: () => void;
}

export function BackgammonResultOverlay({
  session,
  stats,
  onRematch,
  onHome,
}: BackgammonResultOverlayProps) {
  const { t } = useSettings();
  // The final position gets its beat before the card covers it (§11).
  const revealed = useResultReveal(session.status !== 'playing');
  if (!revealed) return null;

  const won = session.status === 'won';
  const title = won
    ? t('backgammonWinTitle')
    : session.status === 'lost'
      ? t('backgammonLoseTitle')
      : t('backgammonNoResultTitle');
  const body = won
    ? t('backgammonWinBody')
    : session.status === 'lost'
      ? t('backgammonLoseBody')
      : t('backgammonNoResultBody');
  const kind = session.result ? t(`backgammonKind_${session.result.kind}`) : null;
  const record = stats[session.difficulty];
  const [you, cpu] = session.board.off;

  return (
    <div className="overlay overlay-result">
      <div
        className={`dialog result ${won ? 'result-clear' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="dialog-title">{title}</h2>
        {kind ? <p className="bk-result-kind">{kind}</p> : null}
        <p className="dialog-body">{body}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('backgammonYou')}</dt>
            <dd>{you}</dd>
          </div>
          <div>
            <dt>{t('backgammonCpu')}</dt>
            <dd>{cpu}</dd>
          </div>
        </dl>

        {/* The standing against this opponent, stated once — never a streak. */}
        <p className="dialog-body">
          {t('backgammonRecordNote', { wins: record.wins, losses: record.losses })}
        </p>

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRematch} autoFocus>
            {t('newGame')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction
          gameId="backgammon"
          outcome={won ? 'completed' : 'played'}
          details={[
            { label: `${t('backgammonBorneOff')} · ${t('backgammonYou')}`, value: String(you) },
            { label: `${t('backgammonBorneOff')} · ${t('backgammonCpu')}`, value: String(cpu) },
            ...(kind ? [{ label: t('backgammonName'), value: kind }] : []),
          ]}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
