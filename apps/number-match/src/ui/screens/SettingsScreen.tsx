import { useState } from 'react';
import { SERIES_ATTRIBUTION, SERIES_BY_LINE, SERIES_NAME } from '@simple-games/brand';
import packageJson from '../../../package.json';
import { LANGUAGE_NAMES } from '../../i18n';
import { useApp } from '../../state/AppContext';
import { useSettings } from '../../state/SettingsContext';
import { LANGUAGES, THEMES, type LanguageSetting, type ThemeSetting } from '../../storage/schemas';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Toggle } from '../components/Toggle';

/**
 * The privacy summary is bundled (works fully offline) and localized via the
 * i18n catalogs. The full hosted policy URL is added before store release.
 */
const PRIVACY_KEYS = ['privacy1', 'privacy2', 'privacy3', 'privacy4'] as const;

export function SettingsScreen() {
  const { goHome, navigate, resetAllData } = useApp();
  const { settings, updateSettings, t } = useSettings();
  const [confirmReset, setConfirmReset] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  return (
    <div className="screen settings-screen">
      <header className="screen-header">
        <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
          ←
        </button>
        <h1>{t('settings')}</h1>
        <span className="icon-btn-placeholder" />
      </header>

      <div className="settings-list">
        <label className="settings-row">
          <span className="settings-row-label">{t('language')}</span>
          <select
            className="settings-select"
            value={settings.language}
            onChange={(event) =>
              updateSettings({ language: event.target.value as LanguageSetting })
            }
          >
            {LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {code === 'system' ? t('languageSystem') : LANGUAGE_NAMES[code]}
              </option>
            ))}
          </select>
        </label>

        <div className="settings-row">
          <span className="settings-row-label">{t('theme')}</span>
          <div className="segmented" role="radiogroup" aria-label={t('theme')}>
            {THEMES.map((theme) => (
              <button
                key={theme}
                type="button"
                role="radio"
                aria-checked={settings.theme === theme}
                className={`segment ${settings.theme === theme ? 'segment-active' : ''}`}
                onClick={() => updateSettings({ theme: theme as ThemeSetting })}
              >
                {theme === 'system' ? t('themeSystem') : theme === 'light' ? t('themeLight') : t('themeDark')}
              </button>
            ))}
          </div>
        </div>

        <Toggle
          label={t('sound')}
          checked={settings.sound}
          onChange={(sound) => updateSettings({ sound })}
        />
        <Toggle
          label={t('vibration')}
          checked={settings.vibration}
          onChange={(vibration) => updateSettings({ vibration })}
        />
        <Toggle
          label={t('reducedMotion')}
          checked={settings.reducedMotion}
          onChange={(reducedMotion) => updateSettings({ reducedMotion })}
        />

        <button type="button" className="settings-row" onClick={() => navigate('tutorial')}>
          <span className="settings-row-label">{t('howToPlay')}</span>
          <span aria-hidden="true">›</span>
        </button>
        <button type="button" className="settings-row" onClick={() => navigate('stats')}>
          <span className="settings-row-label">{t('statistics')}</span>
          <span aria-hidden="true">›</span>
        </button>
        <button type="button" className="settings-row" onClick={() => setShowPrivacy(true)}>
          <span className="settings-row-label">{t('privacyPolicy')}</span>
          <span aria-hidden="true">›</span>
        </button>
        <button
          type="button"
          className="settings-row settings-row-danger"
          onClick={() => setConfirmReset(true)}
        >
          <span className="settings-row-label">{t('resetData')}</span>
          <span aria-hidden="true">›</span>
        </button>

        <div className="settings-row settings-row-static">
          <span className="settings-row-label">{t('version')}</span>
          <span className="settings-row-value">{packageJson.version}</span>
        </div>
      </div>

      <footer className="brand-footer">
        <span className="brand-name">{SERIES_NAME}</span>
        <span className="brand-by">{SERIES_BY_LINE}</span>
      </footer>

      <ConfirmDialog
        open={confirmReset}
        title={t('resetConfirmTitle')}
        body={t('resetConfirmBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('delete')}
        danger
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          void resetAllData();
        }}
      />

      {showPrivacy ? (
        <div className="overlay" onClick={() => setShowPrivacy(false)}>
          <div
            className="dialog privacy-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t('privacyPolicy')}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="dialog-title">{t('privacyPolicy')}</h2>
            {PRIVACY_KEYS.map((key) => (
              <p key={key} className="dialog-body">
                {t(key)}
              </p>
            ))}
            <p className="dialog-body privacy-attribution">{SERIES_ATTRIBUTION}</p>
            <div className="dialog-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowPrivacy(false)}
                autoFocus
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
