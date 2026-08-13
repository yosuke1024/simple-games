/**
 * The Ludo game screen (docs/LUDO_RULES.md §7, §8, §9, §12).
 *
 * **One tap, not two.** The die decides where a pawn goes, so there is no
 * destination to pick: throw, then tap one of the pawns that lit up and it
 * moves. The board sinks everything else, which is the whole of this game's
 * help — the rules made visible, never a suggestion of which pawn is best
 * (§7). There is no hint, no dice boost, and **no undo**: the faces are fixed
 * by the seed before the match starts, so a take-back would either preview a
 * throw or re-roll it (game/session.ts §6).
 *
 * **The screen resolves no rules.** An automatic pass and a forfeited third
 * six are settled inside the engine before the session comes back (§2.1,
 * §2.6); all that arrives here is `lastRoll.kind`, and all this does with it
 * is say so quietly on the status line, the way Reversi announces a pass. The
 * board is drawn from `session.state` and never from the roll event, which
 * carries no board to be tempted by.
 *
 * The chain of CPU beats belongs to the context, not here (state/GameContext.tsx).
 *
 * The clock is not on screen. Neither is anything that counts down (§8).
 */
import { useCallback, useEffect, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconRetry } from '@/ui/components/icons';
import { useTransientTimeout } from '@/ui/useTransientTimeout';
import { HOME_PROGRESS, SEATS, YOU } from '../../game';
import { useLudo } from '../../state/GameContext';
import { LudoBoard } from '../components/LudoBoard';
import { LudoDie } from '../components/LudoDie';
import { LudoResultOverlay } from '../components/LudoResultOverlay';
import { seatLabel } from '../components/seatText';

/** How long a quiet notice — an automatic pass, a third six — stays up. */
const NOTICE_MS = 1800;

export function LudoGameScreen() {
  const { session, stats, movable, canRoll, lastResult, roll, movePawn, goHome, startNewGame } =
    useLudo();
  const { t } = useSettings();
  const noticeTimeout = useTransientTimeout();
  const [confirmNewGame, setConfirmNewGame] = useState(false);
  /** What the last throw resolved to, in words, for a beat. */
  const [notice, setNotice] = useState<string | null>(null);

  const onPawn = useCallback(
    (pawn: 0 | 1 | 2 | 3) => {
      if (movePawn(pawn)) {
        sounds.select();
        void haptics.tap();
      }
    },
    [movePawn],
  );

  const onRoll = useCallback(() => {
    if (roll()) {
      sounds.select();
      void haptics.tap();
    }
  }, [roll]);

  // Every throw is one effect run, and re-renders are not throws: `lastRoll` is
  // a fresh object per throw and the same object across the move that answers
  // it (game/session.ts), so its identity is the throw's identity.
  const lastRoll = session?.lastRoll ?? null;
  useEffect(() => {
    if (!lastRoll) return;
    const line =
      lastRoll.kind === 'autoPass'
        ? t('ludoAutoPass')
        : lastRoll.kind === 'thirdSix'
          ? t('ludoThirdSix')
          : null;
    if (line === null) {
      setNotice(null);
      return;
    }
    setNotice(line);
    noticeTimeout(() => setNotice(null), NOTICE_MS);
  }, [lastRoll, noticeTimeout, t]);

  const status = session?.status;
  useEffect(() => {
    if (status === 'won') {
      sounds.clear();
      void haptics.clear();
    } else if (status === 'lost' || status === 'noContest') {
      sounds.gameOver();
      void haptics.invalid();
    }
  }, [status]);

  if (!session) return null;

  const state = session.state;
  const matchOver = session.status !== 'playing';
  const yourTurn = !matchOver && state.turn === YOU;

  // A run of sixes belongs to the seat on turn and resets the moment the turn
  // changes seat (game/types.ts), so a non-zero streak on your throw is
  // exactly "a six bought you this one" (§2.1) — worth saying, because
  // otherwise the extra throw looks like the turn never moved on.
  const throwingAgain = yourTurn && state.die === null && state.sixStreak > 0;

  const line =
    notice ??
    (matchOver
      ? ''
      : yourTurn
        ? state.die === null
          ? throwingAgain
            ? t('ludoRollAgain')
            : t('ludoTurnRoll')
          : t('ludoTurnMove', { die: state.die })
        : t('ludoTurnCpu', { n: state.turn }));

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={matchOver || confirmNewGame}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <span className="icon-btn-placeholder" />
          <button
            type="button"
            className="icon-btn"
            aria-label={t('newGame')}
            onClick={() => setConfirmNewGame(true)}
          >
            <IconRetry />
          </button>
        </header>

        <div className="ld-body">
          {/* The four seats, each with how many of its pawns are home. A
              standing, never a target being counted down, and never a clock.
              Its own row rather than a slot in the top bar: four seats named
              and counted do not fit between two icon buttons at 320px. */}
          <ul className="ld-seats">
            {SEATS.map((seat) => {
              const home = state.pawns[seat].filter(
                (progress) => progress === HOME_PROGRESS,
              ).length;
              return (
                <li
                  key={seat}
                  className={`ld-seat-item ${state.turn === seat && !matchOver ? 'ld-seat-on' : ''}`}
                >
                  <span className={`ld-chip ld-seat-${seat}`} aria-hidden="true" />
                  <span className="ld-seat-name" aria-hidden="true">
                    {seatLabel(t, seat)}
                  </span>
                  <span className="ld-seat-home" aria-hidden="true">
                    {home}/4
                  </span>
                  <span className="visually-hidden">
                    {`${seatLabel(t, seat)} — ${t('ludoSeatHome', { home })}`}
                  </span>
                </li>
              );
            })}
          </ul>

          <LudoBoard
            pawns={state.pawns}
            movable={movable}
            playing={!matchOver && !confirmNewGame}
            onPawn={onPawn}
          />

          <div className="ld-tray">
            <LudoDie
              face={state.die ?? lastRoll?.die ?? null}
              rollSerial={state.rollIndex}
              canRoll={canRoll}
              onRoll={onRoll}
            />
            {/* One line, always present, so the board never jumps: what to do
                now, or — for a beat — what the throw that just happened did. */}
            <p className="ld-line" role="status">
              {line}
            </p>
          </div>
        </div>

        <BannerSlot />
      </div>

      <LudoResultOverlay
        session={session}
        lastResult={lastResult}
        stats={stats}
        onRematch={() => startNewGame(session.difficulty)}
        onHome={goHome}
      />

      <ConfirmDialog
        open={confirmNewGame}
        title={t('confirmNewGameTitle')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setConfirmNewGame(false)}
        onConfirm={() => {
          setConfirmNewGame(false);
          startNewGame(session.difficulty);
        }}
      />
    </div>
  );
}
