/**
 * How a run ends (docs/ECHO_PADS_RULES.md §5, §9): the facts and nothing to
 * chase — no score, no stars, no praise, no time (the time is the playback's
 * as much as the player's, §9). Two shapes, because the two endings show
 * different things:
 *
 * - **Cleared** — a centred card (`EchoPadsResultOverlay`). The round is over
 *   and nothing behind it is left to read. It waits a beat
 *   (`useResultReveal`) so the last press lands before it covers the pads.
 * - **A miss** — a panel in the page flow, under the pads
 *   (`EchoPadsMissPanel`), never on top of them: the pad that came next is
 *   ringed on the board, and the round can be heard again from the ▶ above as
 *   often as wanted (§5, §6). A card covering the answer it announces would be
 *   Number Recall's first mistake again (RecallRevealPanel). Nothing on it is
 *   on a timer.
 *
 * Both offer a new sequence at the same level — a new attempt, never the same
 * sequence (§1) — and the shared, quiet `ShareAction` with the facts on
 * screen (at most three: the run, the longest length returned, how often it
 * was heard again).
 */
import { Fragment, type KeyboardEvent } from 'react';
import type { ShareDetail } from '@/services/share/message';
import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import { longestReturned, nextLevelInTier, type EchoSession, type Pace } from '../../game';
import { paceName, padName, runDetail, runName, type Translate } from '../labels';

/** A held Enter or Space presses a button once, not once per repeat. */
function swallowRepeatedPress(event: KeyboardEvent<HTMLDivElement>) {
  if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
}

function longestText(t: Translate, session: EchoSession): string {
  const longest = longestReturned(session);
  return longest === 0 ? t('echoPadsLongestNone') : t('echoPadsLength', { n: longest });
}

function shareDetails(t: Translate, session: EchoSession): ShareDetail[] {
  return [
    { label: runName(t, session), value: runDetail(t, session) },
    { label: t('echoPadsLongest'), value: longestText(t, session) },
    { label: t('echoPadsReplays'), value: String(session.replays) },
  ];
}

/**
 * The paces a run was heard at, in the order first used (§9), each name kept
 * whole: a long list breaks between paces, never inside one ("Chậm rãi").
 */
function PacesValue({ t, paces }: { t: Translate; paces: readonly Pace[] }) {
  if (paces.length === 0) return <>{t('echoPadsLongestNone')}</>;
  return (
    <>
      {paces.map((pace, index) => (
        <Fragment key={pace}>
          {index > 0 ? ' · ' : null}
          <span className="ep-pace-name">{paceName(t, pace)}</span>
        </Fragment>
      ))}
    </>
  );
}

/** The facts both endings list: longest returned, heard again, the paces. */
function Facts({ t, session }: { t: Translate; session: EchoSession }) {
  return (
    <dl className="result-facts ep-facts">
      <div>
        <dt>{t('echoPadsLongest')}</dt>
        <dd>{longestText(t, session)}</dd>
      </div>
      <div>
        <dt>{t('echoPadsReplays')}</dt>
        <dd>{session.replays}</dd>
      </div>
      <div>
        <dt>{t('echoPadsPacesHeard')}</dt>
        <dd className="ep-facts-paces">
          <PacesValue t={t} paces={session.pacesHeard} />
        </dd>
      </div>
    </dl>
  );
}

export interface EchoPadsResultOverlayProps {
  session: EchoSession;
  onNextLevel: () => void;
  onRetry: () => void;
  onHome: () => void;
}

export function EchoPadsResultOverlay({
  session,
  onNextLevel,
  onRetry,
  onHome,
}: EchoPadsResultOverlayProps) {
  const { t } = useSettings();
  const revealed = useResultReveal(session.status === 'cleared');
  if (!revealed) return null;

  const title = t('echoPadsResultTitle', { n: session.target });
  const hasNext =
    session.mode === 'level' && session.level !== null && nextLevelInTier(session.level) !== null;

  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result result-clear ep-result"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onKeyDownCapture={swallowRepeatedPress}
      >
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">
          {runName(t, session)} · {runDetail(t, session)}
        </p>
        <Facts t={t} session={session} />
        <div className="result-actions">
          {hasNext ? (
            <button type="button" className="btn btn-primary" onClick={onNextLevel} autoFocus>
              {t('nextLevel')}
            </button>
          ) : null}
          <button
            type="button"
            className={`btn ${hasNext ? 'btn-secondary' : 'btn-primary'}`}
            onClick={onRetry}
            autoFocus={!hasNext}
          >
            {t('echoPadsNewSequence')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="echo-pads" outcome="completed" details={shareDetails(t, session)} />
      </div>
      <ResultAdSlot />
    </div>
  );
}

export interface EchoPadsMissPanelProps {
  session: EchoSession;
  onRetry: () => void;
  onHome: () => void;
}

export function EchoPadsMissPanel({ session, onRetry, onHome }: EchoPadsMissPanelProps) {
  const { t } = useSettings();
  const failure = session.failure;
  if (failure === null) return null;

  return (
    <section className="ep-miss" aria-labelledby="ep-miss-title">
      <h2 className="ep-miss-title" id="ep-miss-title">
        {t('echoPadsMissTitle', { k: failure.round })}
      </h2>
      <p className="ep-miss-body" role="status">
        {t('echoPadsMissBody', {
          index: failure.index + 1,
          k: failure.round,
          pad: padName(t, session.padCount, failure.expected),
        })}
      </p>
      <Facts t={t} session={session} />
      <div className="ep-miss-actions">
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          {t('echoPadsNewSequence')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onHome}>
          {t('backHome')}
        </button>
      </div>
      <ShareAction gameId="echo-pads" outcome="played" details={shareDetails(t, session)} />
    </section>
  );
}
