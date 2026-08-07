/**
 * The Reversi game screen (docs/REVERSI_RULES.md §2, §4, §6, §11).
 *
 * The disc counts are on screen because they are the position, not a target
 * being counted down; the clock is not on screen at all (§11). The turn line
 * says whose move it is, and a pass — a rule's consequence, not an error —
 * is a quiet transient notice with no sound (§4).
 *
 * Help is Undo and the legal-move dots, both free (§6, §7). There is no
 * hint — the whole board is visible, and a "best move" button would be the
 * CPU playing both sides.
 */
import { useCallback, useEffect, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconRetry, IconUndo } from '@/ui/components/icons';
import { useTransientTimeout } from '@/ui/useTransientTimeout';
import { BLACK, canUndo, countDiscs } from '../../game';
import { useReversi } from '../../state/GameContext';
import { ReversiBoard } from '../components/ReversiBoard';
import { ReversiResultOverlay } from '../components/ReversiResultOverlay';

/** How long a pass notice stays up — read at a glance, gone by the reply (§4). */
const PASS_NOTICE_MS = 2200;

export function ReversiGameScreen() {
  const { session, stats, lastMove, lastResult, playMove, applyUndo, goHome, startNewGame } =
    useReversi();
  const { t } = useSettings();
  const noticeTimeout = useTransientTimeout();
  const [confirmNewGame, setConfirmNewGame] = useState(false);
  /** Who was skipped, as "me" or "them" — the colour is not the point (§4). */
  const [passNotice, setPassNotice] = useState<'mine' | 'theirs' | null>(null);

  const onPlace = useCallback(
    (cell: number) => {
      if (playMove(cell)) {
        sounds.select();
        void haptics.tap();
      }
    },
    [playMove],
  );

  const onUndo = useCallback(() => {
    if (applyUndo()) sounds.undo();
  }, [applyUndo]);

  // The CPU's reply arrives outside any tap of ours, so its sounds — and the
  // end of the match, whichever move it lands on — are played off the move
  // record. One effect run per move: the move counter is the identity.
  const playerColor = session?.playerColor;
  useEffect(() => {
    if (!lastMove || playerColor === undefined) return;
    if (lastMove.by !== playerColor) {
      sounds.select();
      if (lastMove.flipped.length > 0) sounds.match();
    }
    // A pass is a consequence, not an error: a notice, and no sound (§4).
    if (lastMove.passed !== null) {
      setPassNotice(lastMove.passed === playerColor ? 'mine' : 'theirs');
      noticeTimeout(() => setPassNotice(null), PASS_NOTICE_MS);
    }
  }, [lastMove, noticeTimeout, playerColor]);

  const status = session?.status;
  useEffect(() => {
    if (status === 'won') {
      sounds.clear();
      void haptics.clear();
    } else if (status === 'lost' || status === 'draw') {
      sounds.gameOver();
      void haptics.invalid();
    }
  }, [status]);

  if (!session) return null;

  const over = session.status !== 'playing';
  const counts = countDiscs(session.board);
  const playersTurn = session.toMove === session.playerColor && !over;
  // The counts are read as "you" and "CPU", each beside the disc that side
  // is actually playing — which colour that is depends on the choice made
  // before the match (§1).
  const playerIsBlack = session.playerColor === BLACK;
  const mine = playerIsBlack ? counts.black : counts.white;
  const theirs = playerIsBlack ? counts.white : counts.black;

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={over || confirmNewGame}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="rv-status">
            <span className="rv-count">
              <span
                className={`rv-count-disc ${playerIsBlack ? 'rv-count-black' : 'rv-count-white'}`}
                aria-hidden="true"
              />
              {t('reversiYou')} {mine}
            </span>
            <span className="rv-count">
              <span
                className={`rv-count-disc ${playerIsBlack ? 'rv-count-white' : 'rv-count-black'}`}
                aria-hidden="true"
              />
              {t('reversiCpu')} {theirs}
            </span>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('newGame')}
            onClick={() => setConfirmNewGame(true)}
          >
            <IconRetry />
          </button>
        </header>

        <div className="rv-body">
          <ReversiBoard
            board={session.board}
            playerColor={session.playerColor}
            toMove={session.toMove}
            playing={!over}
            lastMove={lastMove}
            onPlace={onPlace}
          />
          {/* One line, always present, so the board never jumps: whose turn
              it is, or — for a beat — whose turn was skipped (§4). */}
          <p className="rv-turn-line" role="status">
            {passNotice !== null
              ? passNotice === 'mine'
                ? t('reversiPassYou')
                : t('reversiPassCpu')
              : over
                ? ''
                : playersTurn
                  ? t('reversiYourTurn')
                  : t('reversiCpuTurn')}
          </p>
        </div>

        <div className="action-bar rv-actions">
          <button
            type="button"
            className="action-btn"
            onClick={onUndo}
            disabled={!canUndo(session)}
          >
            <span className="action-icon" aria-hidden="true">
              <IconUndo />
            </span>
            {t('undo')}
          </button>
        </div>

        <BannerSlot />
      </div>

      <ReversiResultOverlay
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
