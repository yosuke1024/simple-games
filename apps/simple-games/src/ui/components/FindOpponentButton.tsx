import { useSettings } from '../../state/SettingsContext';

/** A collection-wide joining door. Merely rendering it never loads Nearby. */
export function FindOpponentButton({
  onFindOpponent,
  active = false,
}: {
  onFindOpponent?: () => void;
  active?: boolean;
}) {
  const { t } = useSettings();
  const appOnly = import.meta.env.MODE === 'web';
  if (!appOnly && !onFindOpponent) return null;
  return (
    <button
      type="button"
      className={`home-play-together${appOnly ? ' play-together-app-only' : ''}`}
      disabled={appOnly}
      onClick={appOnly ? undefined : onFindOpponent}
    >
      <span className="home-play-together-title">
        {t(!appOnly && active ? 'returnToTogether' : 'findNearbyOpponents')}
      </span>
      {(!active || appOnly) && (
        <span className="home-play-together-body">
          {t(appOnly ? 'playTogetherAppOnlyNote' : 'findNearbyOpponentsNote')}
        </span>
      )}
    </button>
  );
}
