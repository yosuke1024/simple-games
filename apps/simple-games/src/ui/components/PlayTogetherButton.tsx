import { useSettings } from '@/state/SettingsContext';

export interface PlayTogetherProps {
  onPlayTogether?: () => void;
  playTogetherActive?: boolean;
}

/** The shell supplies availability; games never load a connection implementation. */
export function PlayTogetherButton({
  onPlayTogether,
  playTogetherActive = false,
}: PlayTogetherProps) {
  const { t } = useSettings();
  if (!onPlayTogether) return null;
  return (
    <button type="button" className="btn btn-secondary btn-big" onClick={onPlayTogether}>
      {t(playTogetherActive ? 'returnToTogether' : 'playTogether')}
      <span className="btn-note">{t('playTogetherNote')}</span>
    </button>
  );
}
