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
      className={`btn btn-secondary home-find-opponent${appOnly ? ' play-together-app-only' : ''}`}
      disabled={appOnly}
      onClick={appOnly ? undefined : onFindOpponent}
    >
      {t(!appOnly && active ? 'returnToTogether' : 'findNearbyOpponents')}
      {(!active || appOnly) && (
        <span className="btn-note">
          {t(appOnly ? 'playTogetherAppOnlyNote' : 'findNearbyOpponentsNote')}
        </span>
      )}
    </button>
  );
}
