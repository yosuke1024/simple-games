import { useSettings } from '@/state/SettingsContext';

export interface PlayTogetherProps {
  onPlayTogether?: () => void;
  playTogetherActive?: boolean;
}

/** Web advertises the app feature without loading or starting a connection. */
export function PlayTogetherButton({
  onPlayTogether,
  playTogetherActive = false,
}: PlayTogetherProps) {
  const { t } = useSettings();
  const appOnly = import.meta.env.MODE === 'web';
  if (!appOnly && !onPlayTogether) return null;
  return (
    <button
      type="button"
      className={`btn btn-secondary btn-big${appOnly ? ' play-together-app-only' : ''}`}
      disabled={appOnly}
      onClick={appOnly ? undefined : onPlayTogether}
    >
      {t(!appOnly && playTogetherActive ? 'returnToTogether' : 'playTogether')}
      <span className="btn-note">
        {t(appOnly ? 'playTogetherAppOnlyNote' : 'playTogetherNote')}
      </span>
    </button>
  );
}
