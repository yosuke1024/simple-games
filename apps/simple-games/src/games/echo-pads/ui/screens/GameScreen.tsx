/**
 * The Echo Pads game screen (docs/ECHO_PADS_RULES.md §4–§6, §11). From the
 * top: the way home and the run's name (no ↻ — a new sequence is on the
 * miss panel and the result card, as in Number Recall), the length line,
 * one spoken line, the pads, then the one ▶ / Stop button and the Pace.
 *
 * Nothing here plays by itself. The ▶ button is the only way a playback
 * starts (the provider walks the timetable); it is Stop while one runs and
 * disabled once the round's input has begun or the run is cleared (§6). The
 * Pace changes only while nothing plays (§4).
 *
 * The spoken line (`aria-live`) says when a playback starts and when it is
 * the player's turn — not every light: a pad every few hundred ms would not
 * fit in speech (§11, not checked with a screen reader). Each pad says its
 * mark and position.
 *
 * Keyboard (§11): digits 1–4 / 1–6 press the pads in reading order; Space and
 * Enter are ▶ / Stop unless a button has the focus (then that button answers,
 * as it would anyway — once: a held key's repeats are swallowed, below).
 * Escape is not the game's. Keys go quiet with the result card up —
 * `.game-content` is inert behind it.
 */
import { useCallback, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { IconBack } from '@/ui/components/icons';
import { useGameKeys } from '@/ui/useGameKeys';
import {
  canChangePace,
  canPlay,
  canPress,
  isPlayingBack,
  padForKey,
  PACES,
  type EchoSession,
} from '../../game';
import { useEchoPads } from '../../state/GameContext';
import { EchoPadsMissPanel, EchoPadsResultOverlay } from '../components/ResultOverlay';
import { PadBoard } from '../components/PadBoard';
import { paceName, runDetail, runName, type Translate } from '../labels';

function statusLine(t: Translate, session: EchoSession): string {
  const k = session.round;
  switch (session.status) {
    case 'idle':
      return t('echoPadsStatusIdle', { k });
    case 'playing-back':
      return t('echoPadsStatusPlaying', { k });
    case 'reviewing':
      return t('echoPadsStatusReview', { k });
    case 'awaiting-input':
      // Back from a run left mid-input: ▶ is withheld and the round starts
      // over from its first pad (§8, decision 8 (B)).
      return session.inputStarted && session.inputCount === 0
        ? t('echoPadsStatusAgain', { k })
        : t('echoPadsStatusYourTurn', { k });
    default:
      return '';
  }
}

/**
 * A held Enter or Space presses a button once, not once per repeat (§11): the
 * pads, ▶ / Stop, the Pace and the miss panel's buttons are buttons, whose
 * own click a held Enter would otherwise fire again on every repeat — a
 * second press of the same pad (a miss, unless the next pad is that one) or
 * ▶ and Stop in turn, each ▶ after the first counted as heard again.
 */
function swallowRepeatedPress(event: ReactKeyboardEvent<HTMLDivElement>) {
  if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
}

function PlayGlyph({ stop }: { stop: boolean }) {
  return (
    <svg className="ep-play-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {stop ? (
        <rect x="6" y="6" width="12" height="12" rx="1.5" />
      ) : (
        <path d="M8 5 L19 12 L8 19 Z" />
      )}
    </svg>
  );
}

export function EchoPadsGameScreen() {
  const { session, pace, litPad, playOrStop, pressPad, setPace, retry, startNextLevel, goHome } =
    useEchoPads();
  const { t } = useSettings();

  const onPress = useCallback((pad: number) => void pressPad(pad), [pressPad]);

  const onKey = (event: KeyboardEvent): boolean => {
    if (!session || event.ctrlKey || event.metaKey || event.altKey) return false;
    if (event.key === ' ' || event.key === 'Enter') {
      // A focused button answers Space and Enter itself.
      if (event.target instanceof HTMLButtonElement) return false;
      if (event.repeat) return true;
      playOrStop();
      return true;
    }
    const pad = padForKey(event.key, session.padCount);
    if (pad === null) return false;
    if (!event.repeat) pressPad(pad);
    return true;
  };
  useGameKeys(onKey, session !== null && session.status !== 'cleared');

  if (!session) return null;

  const cleared = session.status === 'cleared';
  const missed = session.status === 'failed' || session.status === 'reviewing';
  const playingBack = isPlayingBack(session);
  const playable = canPlay(session);
  const playLabel = playingBack
    ? t('echoPadsStop')
    : session.status === 'idle'
      ? t('echoPadsPlay')
      : t('echoPadsListenAgain');

  return (
    <div className="screen game-screen ep-screen">
      <div className="game-content" inert={cleared} onKeyDownCapture={swallowRepeatedPress}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="ep-title">
            <span className="ep-title-name">{runName(t, session)}</span>
            <span className="ep-title-detail">{runDetail(t, session)}</span>
          </div>
          <span className="icon-btn-placeholder" />
        </header>

        <div className="ep-body">
          {/* After a miss the panel's title says the length, and the room is
              the panel's: 360 × 640 with the web's ad reserve (§11). */}
          {missed ? null : (
            <p className="ep-round">
              <span>{t('echoPadsRound', { k: session.round, target: session.target })}</span>
              {session.status === 'awaiting-input' && session.inputStarted ? (
                <span className="ep-count">
                  {session.inputCount} / {session.round}
                </span>
              ) : null}
            </p>
          )}
          {/* Still spoken while the miss panel is up (hearing the round
              again), but no longer drawn: the panel shows what happened. */}
          <p className={missed ? 'ep-status ep-status-quiet' : 'ep-status'} aria-live="polite">
            {statusLine(t, session)}
          </p>

          <div className="ep-board-area">
            <PadBoard
              padCount={session.padCount}
              litPad={litPad}
              expectedPad={missed ? (session.failure?.expected ?? null) : null}
              pressable={canPress(session)}
              onPress={onPress}
              t={t}
            />
          </div>

          <div className="ep-controls">
            <button
              type="button"
              className={`btn ${playingBack ? 'btn-secondary' : 'btn-primary'} ep-play`}
              onClick={playOrStop}
              disabled={!playingBack && !playable}
            >
              <PlayGlyph stop={playingBack} />
              <span>{playLabel}</span>
            </button>
            <div className="ep-pace" role="group" aria-label={t('echoPadsPace')}>
              {PACES.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`ep-pace-option ${option === pace ? 'ep-pace-current' : ''}`}
                  aria-pressed={option === pace}
                  disabled={!canChangePace(session)}
                  onClick={() => setPace(option)}
                >
                  {paceName(t, option)}
                </button>
              ))}
            </div>
          </div>

          {missed ? <EchoPadsMissPanel session={session} onRetry={retry} onHome={goHome} /> : null}
        </div>

        <BannerSlot />
      </div>

      <EchoPadsResultOverlay
        session={session}
        onNextLevel={startNextLevel}
        onRetry={retry}
        onHome={goHome}
      />
    </div>
  );
}
