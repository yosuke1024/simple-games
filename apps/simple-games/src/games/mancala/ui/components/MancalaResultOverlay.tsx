/**
 * The one thing this game has to say at the end: whose store holds more
 * (§3), and the two counts that say it. It mentions the standing record
 * against this opponent quietly and offers a rematch. A loss is stated, never
 * scolded; there is no revival to buy and no ad to watch for one more move
 * (docs/MANCALA_RULES.md §7, ADS_POLICY.md).
 */
import { useMemo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ClubResultAction } from '@/ui/components/ClubResultAction';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import { storeCounts, type MancalaSession } from '../../game';
import type { Stats } from '../../storage/schemas';

export interface MancalaResultOverlayProps {
  session: MancalaSession;
  stats: Stats;
  onRematch: () => void;
  onHome: () => void;
}

export function MancalaResultOverlay({
  session,
  stats,
  onRematch,
  onHome,
}: MancalaResultOverlayProps) {
  const { t } = useSettings();
  // The swept board gets its beat before the card covers it (§10).
  const revealed = useResultReveal(session.status !== 'playing');
  const stores = storeCounts(session.pits);
  const you = stores.player;
  const cpu = stores.cpu;
  // The match's facts, once: the share's strings and the Club's figures are
  // read from the same fields (docs/architecture/club.md §6-1).
  const facts = useMemo(() => ({ score: you, cpuScore: cpu }), [you, cpu]);
  if (!revealed) return null;

  const title =
    session.status === 'won'
      ? t('mancalaWinTitle')
      : session.status === 'lost'
        ? t('mancalaLoseTitle')
        : t('mancalaDrawTitle');
  const body =
    session.status === 'won'
      ? t('mancalaWinBody')
      : session.status === 'lost'
        ? t('mancalaLoseBody')
        : t('mancalaDrawBody');
  const record = stats[session.difficulty];
  const details = [
    { label: t('mancalaYou'), value: String(you) },
    { label: t('mancalaCpu'), value: String(cpu) },
  ];

  return (
    <div className="overlay overlay-result">
      <div
        className={`dialog result ${session.status === 'won' ? 'result-clear' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">{body}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('mancalaYou')}</dt>
            <dd>{stores.player}</dd>
          </div>
          <div>
            <dt>{t('mancalaCpu')}</dt>
            <dd>{stores.cpu}</dd>
          </div>
        </dl>

        {/* The standing against this opponent, stated once — never a streak. */}
        <p className="dialog-body">
          {t('mancalaRecordNote', { wins: record.wins, losses: record.losses })}
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
          gameId="mancala"
          outcome={session.status === 'won' ? 'completed' : 'played'}
          // The final stores, win or lose or draw — the score line this card
          // shows, and the one honest summary of a finished game.
          details={details}
        />
        <ClubResultAction
          gameId="mancala"
          outcome="completed"
          details={details}
          facts={facts}
          seed={session.seed}
          params={{ difficulty: session.difficulty }}
          boardDigest={null}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
