/**
 * The optional share on a result screen (issue #86): one small button that
 * hands this game to somebody else, and nothing more.
 *
 * WHAT MAKES IT OPTIONAL, AND WHY THAT IS THE WHOLE DESIGN
 *
 * It is never opened for the player, never asked for twice, and never
 * rewarded. Sharing unlocks nothing, removes no ad, and changes no number the
 * app keeps — a player who never presses it plays exactly the same game as one
 * who presses it every time. This is the line between an invitation and a
 * growth mechanic, and the whole feature sits on this side of it: the button
 * is quiet, drawn below the buttons that continue play, and it says what it
 * does before it does anything.
 *
 * The message is built from the game's id and the honest result — the games
 * pass `completed` only where the player actually won — so no result screen
 * has to write share copy of its own, and none of them can accidentally send a
 * score, a time, or a streak (services/share/message.ts).
 *
 * Games render this the way they render ResultAdSlot: an import from shared
 * UI, inside their own result card (docs/ARCHITECTURE.md, レイヤー規則).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameId } from '../../app/registry';
import { shareGame } from '../../services/share/share';
import { buildShareMessage, type ShareOutcome } from '../../services/share/message';
import { useSettings } from '../../state/SettingsContext';
import { useTransientTimeout } from '../useTransientTimeout';
import { IconShare } from './icons';

/** Long enough to read, short enough that it is gone before the next board. */
const COPIED_MS = 2400;

export interface ShareActionProps {
  gameId: GameId;
  /**
   * What actually happened. `completed` only where the game was won or
   * cleared; every loss, draw and endless run is `played`.
   */
  outcome: ShareOutcome;
}

export function ShareAction({ gameId, outcome }: ShareActionProps) {
  const { t } = useSettings();
  const [copied, setCopied] = useState(false);
  const hideLater = useTransientTimeout();
  // The share sheet outlives the screen easily — a player can leave for Home
  // while it is open. The result then arrives for a component that is gone,
  // and the note it would have shown has nowhere to appear.
  const mounted = useRef(true);
  useEffect(() => {
    // Set on the way in as well as cleared on the way out: StrictMode's
    // invoke-cleanup-invoke cycle would otherwise leave this false for the
    // life of a component that is very much still on screen.
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onShare = useCallback(() => {
    // Nothing is awaited before shareGame(), so the click's user activation is
    // still valid when the share sheet is asked for.
    void shareGame(buildShareMessage(gameId, outcome, t)).then((result) => {
      if (!mounted.current || result !== 'copied') return;
      setCopied(true);
      hideLater(() => setCopied(false), COPIED_MS);
    });
  }, [gameId, outcome, t, hideLater]);

  return (
    <div className="result-share">
      <button type="button" className="result-share-btn" onClick={onShare}>
        <IconShare />
        {t('shareAction')}
      </button>
      {/* Always in the tree, so a screen reader announces the confirmation
          when it arrives instead of announcing a region that just appeared. */}
      <span className="result-share-note" role="status">
        {copied ? t('shareCopied') : ''}
      </span>
    </div>
  );
}
