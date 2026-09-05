/**
 * The frame every game home shares: the web build's site chrome, then the
 * header row with the back-to-collection button and the shell's own controls
 * (`GameHomeActions`). Thirty games rendered these lines byte-for-byte alike,
 * and every shell feature that landed in the header — the favourite star
 * (#109), "Add to Home Screen" (#110) — was a thirty-file sweep. Now it is
 * one file: the shell owns the frame, the game owns what comes after it
 * (docs/ARCHITECTURE.md「シェルの枠とゲームの中身」).
 *
 * Deliberately a frame and nothing more. It takes the game's id and the exit
 * callback; it does not take a title, a glyph, a tagline, or any switch that
 * would let one game's home differ from another's through configuration —
 * the hero below the header is the game's own, and eleven of the thirty draw
 * it their own way on purpose. A game that needs something else in the
 * header composes it after this component; it does not ask for a prop.
 *
 * The markup is exactly what each home rendered before, so nothing about
 * layout, focus order, or the `homeActionsWiring` gate's expectations moved:
 * that gate now looks for this component, and still requires each game to
 * name itself.
 */
import type { GameId } from '../../app/registry';
import { useSettings } from '../../state/SettingsContext';
import { GameHomeActions } from './GameHomeActions';
import { IconBack } from './icons';
import { WebChromeSlot } from './WebChromeSlot';

export interface GameHomeHeaderProps {
  /** The game this home belongs to. It names itself; nothing infers it. */
  gameId: GameId;
  /** Hands control back to the collection home. */
  onBack: () => void;
}

export function GameHomeHeader({ gameId, onBack }: GameHomeHeaderProps) {
  const { t } = useSettings();
  return (
    <>
      {/* Web build only — the shared PixApps header (docs/WEB_VERSION.md
          「サイトクローム」). Renders nothing on the native app. A game's
          board and result screens deliberately have none. */}
      <WebChromeSlot />

      <header className="screen-header">
        <button type="button" className="icon-btn" aria-label={t('backToGames')} onClick={onBack}>
          <IconBack />
        </button>
        <GameHomeActions gameId={gameId} />
      </header>
    </>
  );
}
