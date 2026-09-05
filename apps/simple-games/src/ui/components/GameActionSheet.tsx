/**
 * The small sheet a long press (or a right-click, or the keyboard's own menu
 * key) opens on a game tile: what can be done with this title other than open
 * it (issue #109). It offers pinning the title to the top of the collection —
 * on every platform — and on Android, separately, pinning it to the OS home
 * screen (issue #110). The two sit side by side because they are two
 * different decisions: favouriting never creates a shortcut, and a shortcut
 * never touches the favourites shelf. Whether the second action exists at all
 * is not this sheet's call — the shell decides that once at boot
 * (`homeShortcutsAvailable`, services/homeShortcut/homeShortcut.ts) and hands
 * this component a callback only when it does; the sheet just draws what it
 * is given.
 *
 * It is deliberately not the only way to pin a favourite. `SettingsScreen`
 * lists every game with the same toggle, because a gesture nobody discovers is
 * not a feature, and because a long press is unavailable to anyone driving the
 * app from a keyboard or a switch.
 */
import { useEffect } from 'react';
import type { GameDefinition } from '../../app/registry';
import { useSettings } from '../../state/SettingsContext';
import { GameTile } from './GameTile';
import { IconAddToHome, IconStar } from './icons';

export interface GameActionSheetProps {
  /** The title the sheet is about; null closes it. */
  game: GameDefinition | null;
  isFavorite: boolean;
  /**
   * True only when a finger was still down as this opened — a long press. It
   * is the one case that produces a stray click, and the guard below is armed
   * for that case alone (see the effect).
   */
  openedMidPress: boolean;
  onToggleFavorite: () => void;
  /**
   * Android only (issue #110): present exactly when the shell has already
   * confirmed the launcher takes pin requests. Absent everywhere else, which
   * is why the sheet draws no second action rather than a disabled one.
   */
  onAddToHomeScreen?: () => void;
  onClose: () => void;
}

export function GameActionSheet({
  game,
  isFavorite,
  openedMidPress,
  onToggleFavorite,
  onAddToHomeScreen,
  onClose,
}: GameActionSheetProps) {
  const { t } = useSettings();

  /**
   * The press that opened this sheet has not finished yet.
   *
   * A long press opens the sheet while the finger is still down, so the click
   * that ends that press is dispatched *after* the sheet is on screen — at
   * whatever the sheet has just put under the finger. Left alone it lands on
   * the backdrop and closes the sheet the instant it appears, or worse, on
   * the action button and pins a game nobody asked to pin. So that one click
   * is swallowed in the capture phase, before React's root sees it.
   *
   * **Only for the long press.** A right-click produces no click at all, and
   * the keyboard's menu key produces no pointer event — arming the guard for
   * those would leave it waiting for a click that never comes, and eat the
   * first real one instead. That is not a hypothetical for a screen reader:
   * TalkBack's double-tap and VoiceOver's activation reach the page as a bare
   * click with no pointer or key event in front of it, so a guard armed on the
   * keyboard route would silently swallow an assistive user's first press.
   *
   * Even when armed, any *new* interaction stands it down: a fresh press or a
   * key means the click either already arrived or is never coming (Android
   * suppresses it after its own long-press menu).
   */
  useEffect(() => {
    if (!game || !openedMidPress) return;
    function release() {
      window.removeEventListener('click', swallow, true);
      window.removeEventListener('pointerdown', release, true);
      window.removeEventListener('keydown', release, true);
    }
    function swallow(event: MouseEvent) {
      event.stopPropagation();
      event.preventDefault();
      release();
    }
    window.addEventListener('click', swallow, true);
    window.addEventListener('pointerdown', release, true);
    window.addEventListener('keydown', release, true);
    return release;
  }, [game, openedMidPress]);

  // Escape closes, as it does for any dialog. Registered on the window rather
  // than the card so it works before focus has reached anything inside.
  useEffect(() => {
    if (!game) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [game, onClose]);

  if (!game) return null;

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="dialog action-sheet"
        role="dialog"
        aria-modal="true"
        // The title is a proper noun, identical in every language
        // (app/registry.ts), so it labels the sheet without a new string.
        aria-label={game.title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="action-sheet-head">
          <GameTile game={game} />
          <span className="action-sheet-title">{game.title}</span>
        </div>

        <button type="button" className="action-sheet-action" onClick={onToggleFavorite} autoFocus>
          <span className="action-sheet-icon" aria-hidden="true">
            <IconStar filled={isFavorite} />
          </span>
          <span className="settings-row-label">
            {isFavorite ? t('removeFromFavorites') : t('addToFavorites')}
          </span>
        </button>

        {onAddToHomeScreen ? (
          // No autoFocus here — the favourite action above keeps first focus,
          // this is only ever the second stop.
          <button type="button" className="action-sheet-action" onClick={onAddToHomeScreen}>
            <span className="action-sheet-icon" aria-hidden="true">
              <IconAddToHome />
            </span>
            <span className="settings-row-label">{t('addToHomeScreen')}</span>
          </button>
        ) : null}

        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
