/**
 * The Dominoes game screen (docs/DOMINOES_RULES.md §3, §7, §11).
 *
 * From the top: the CPU's tile count and the boneyard's, as counts only (§6);
 * the line of play; one status line that always says what happens now; the
 * player's hand; and Draw — plus Pass, which exists only while a pass is the
 * one thing the rules allow.
 *
 * A tile that fits one end is played by tapping it. A tile that fits both
 * ends, where they differ, is lifted by the first tap and the ends become the
 * choice (§3); tapping the tile again puts it back. When both ends show the
 * same pips there is nothing to choose and the tile goes on the right.
 *
 * There is no Undo and no hint (§7), and no clock (§11).
 */
import { useCallback, useEffect, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconRetry } from '@/ui/components/icons';
import {
  canDraw,
  canPass,
  canPlay,
  CPU,
  distinctEnds,
  PLAYER,
  sameTile,
  type End,
  type Tile,
} from '../../game';
import { useDominoes } from '../../state/GameContext';
import { DominoesHand } from '../components/DominoesHand';
import { DominoesLine } from '../components/DominoesLine';
import { DominoesResultOverlay } from '../components/DominoesResultOverlay';
import { TileBack, tileText } from '../components/TileFace';

/** A lifted tile belongs to the position it was lifted in, and to no other. */
interface Selection {
  readonly tile: Tile;
  readonly position: string;
}

export function DominoesGameScreen() {
  const { session, stats, lastAction, playTile, drawTile, passTurn, goHome, startNewGame } =
    useDominoes();
  const { t } = useSettings();
  const [confirmNewGame, setConfirmNewGame] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);

  // Any action — the player's or the CPU's — is a new position, and a tile
  // lifted in the old one is simply no longer lifted.
  const position = session ? `${session.seed}:${session.moveCount}` : '';
  const selected = selection !== null && selection.position === position ? selection.tile : null;

  // Every action has its sound, whoever took it: a click for a tile put
  // down, a tick for a draw or a pass (§11). One effect run per action — the
  // record changes identity exactly once per action.
  useEffect(() => {
    if (!lastAction) return;
    if (lastAction.kind === 'play') sounds.select();
    else sounds.undo();
  }, [lastAction]);

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

  const onTile = useCallback(
    (tile: Tile) => {
      if (!session) return;
      if (selected !== null && sameTile(selected, tile)) {
        setSelection(null);
        return;
      }
      const ends = distinctEnds(session.line, tile);
      if (ends.length === 2) {
        setSelection({ tile, position });
        void haptics.tap();
        return;
      }
      if (ends.length === 1 && playTile(tile, ends[0]!)) void haptics.tap();
    },
    [playTile, position, selected, session],
  );

  const onChooseEnd = useCallback(
    (end: End) => {
      if (selected !== null && playTile(selected, end)) void haptics.tap();
    },
    [playTile, selected],
  );

  const onDraw = useCallback(() => {
    if (drawTile()) void haptics.tap();
  }, [drawTile]);

  const onPass = useCallback(() => {
    if (passTurn()) void haptics.tap();
  }, [passTurn]);

  if (!session) return null;

  const over = session.status !== 'playing';
  const playersTurn = !over && session.toMove === PLAYER;
  const mayDraw = canDraw(session, PLAYER);
  const mayPass = canPass(session, PLAYER);
  const opening = tileText(session.opening.tile[0], session.opening.tile[1]);

  // One line, always present, so nothing below it jumps (§11): what the
  // player can do now, or what the CPU just did.
  const statusLine = (): string => {
    if (over) return '';
    if (!playersTurn) {
      if (session.moveCount === 1) return t('dominoesOpenedYou', { tile: opening });
      if (lastAction?.by === CPU && lastAction.kind === 'draw') return t('dominoesCpuDrew');
      return t('dominoesCpuTurn');
    }
    if (selected !== null) return t('dominoesChooseEnd');
    if (!canPlay(session, PLAYER)) return mayDraw ? t('dominoesMustDraw') : t('dominoesNoTileFits');
    if (session.moveCount === 1) return t('dominoesOpenedCpu', { tile: opening });
    if (lastAction?.by === CPU && lastAction.kind === 'pass') return t('dominoesCpuPassed');
    return t('dominoesYourTurn');
  };

  // The newest tile is at whichever end it was played on.
  const freshIndex =
    lastAction?.kind === 'play' && lastAction.moveCount === session.moveCount
      ? lastAction.end === 'left'
        ? 0
        : session.line.length - 1
      : null;

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={over || confirmNewGame}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          {/* What is hidden, as counts and nothing more (§6). */}
          <div className="dm-status">
            <span className="dm-count">
              <TileBack upright />
              <span aria-hidden="true">
                {t('dominoesCpuShort')} {session.cpuHand.length}
              </span>
              <span className="visually-hidden">
                {t('dominoesCpuTiles', { count: session.cpuHand.length })}
              </span>
            </span>
            <span className="dm-count">
              <TileBack upright />
              <span aria-hidden="true">
                {t('dominoesBoneyardShort')} {session.boneyard.length}
              </span>
              <span className="visually-hidden">
                {t('dominoesBoneyardTiles', { count: session.boneyard.length })}
              </span>
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

        <div className="dm-body">
          <DominoesLine
            line={session.line}
            choosing={playersTurn && selected !== null}
            onChooseEnd={onChooseEnd}
            freshIndex={freshIndex}
          />
          <p className="dm-status-line" role="status">
            {statusLine()}
          </p>
          <DominoesHand
            hand={session.playerHand}
            line={session.line}
            active={playersTurn}
            selected={selected}
            onTile={onTile}
          />
        </div>

        {/* Draw is always here, enabled only when the rules require it (§3).
            Pass appears only when it is the one thing left to do — its
            absence is the answer to "may I pass?". */}
        <div className="action-bar dm-actions">
          <button type="button" className="action-btn" onClick={onDraw} disabled={!mayDraw}>
            {t('dominoesDraw')}
          </button>
          {mayPass ? (
            <button type="button" className="action-btn" onClick={onPass}>
              {t('dominoesPass')}
            </button>
          ) : null}
        </div>

        <BannerSlot />
      </div>

      <DominoesResultOverlay
        session={session}
        stats={stats}
        onRematch={startNewGame}
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
          startNewGame();
        }}
      />
    </div>
  );
}
