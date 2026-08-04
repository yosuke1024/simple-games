/**
 * Catches a game that failed to load or crashed while rendering, and keeps
 * the shell alive: the collection must survive any single game's failure
 * (docs/ARCHITECTURE.md — one game's corruption never takes the home down).
 *
 * "All games" is the dependable way out. Retry is offered but best-effort:
 * React caches a rejected lazy load and Chromium caches a failed module
 * fetch, so the retry path recreates the lazy wrapper (app/lazyRoots.ts) and
 * remounts — which helps for transient failures and honestly cannot promise
 * more. On the native build chunks are local files, so this screen should
 * effectively never appear there.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useHardwareBackExit } from '../useHardwareBackExit';

function GameLoadError({ onRetry, onExit }: { onRetry: () => void; onExit: () => void }) {
  const { t } = useSettings();
  // Same ownerless-back moment as during loading: the shell's listener is off
  // while the view is a game, and the failed game never registered one.
  useHardwareBackExit(onExit);
  return (
    <div className="screen game-load-screen">
      <p className="game-load-text">{t('gameLoadFailed')}</p>
      <div className="dialog-actions">
        <button type="button" className="btn btn-ghost" onClick={onRetry}>
          {t('gameLoadRetry')}
        </button>
        <button type="button" className="btn btn-primary" onClick={onExit} autoFocus>
          {t('backToGames')}
        </button>
      </div>
    </div>
  );
}

interface Props {
  /** Recreates the lazy wrapper and remounts (App.tsx bumps the key). */
  onRetry: () => void;
  onExit: () => void;
  children: ReactNode;
}

export class GameErrorBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    // No analytics by principle; the console is for a developer with a cable.
    console.error('game failed to load or render', error, info.componentStack);
  }

  override render() {
    if (this.state.failed) {
      return <GameLoadError onRetry={this.props.onRetry} onExit={this.props.onExit} />;
    }
    return this.props.children;
  }
}
