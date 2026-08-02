/**
 * Shared settings for the whole collection, plus the About block that carries
 * the brand's honesty promises: the quiet ad/support message, the one-time
 * ad-removal purchase (never pushed, shown only here), and the open-source
 * links that let anyone verify the promises in code.
 *
 * External links open the system browser; offline they simply do nothing —
 * this screen itself must always render (docs/OFFLINE_POLICY.md).
 */
import { useEffect, useState } from 'react';
import {
  PRIVACY_URL,
  SERIES_BY_LINE,
  SERIES_NAME,
  SOURCE_REPO_URL,
  TERMS_URL,
} from '@simple-games/brand';
import packageJson from '../../../package.json';
import { GAMES } from '../../app/registry';
import { LANGUAGE_NAMES } from '../../i18n';
import {
  getAdRemovalPrice,
  initAdRemoval,
  purchaseAdRemoval,
  restoreAdRemoval,
} from '../../monetization/adRemoval';
import { useAdRemovalPurchased, usePurchaseAvailable } from '../../monetization/useAdRemoval';
import { isNativeAdsPlatform } from '../../services/ads/banner';
import { initReview } from '../../services/review';
import { useSettings } from '../../state/SettingsContext';
import { clearLocalData } from '../../storage/repo';
import {
  LANGUAGES,
  settingsSchema,
  STORAGE_KEYS,
  THEMES,
  type LanguageSetting,
  type ThemeSetting,
} from '../../storage/schemas';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IconBack, IconChevronRight } from '../components/icons';
import { Toggle } from '../components/Toggle';
import { openExternal } from '../openExternal';

/**
 * About links. The privacy policy and terms are LINKS, not bundled text
 * (2026-08-02): the pages at pixapps.ai are the single source for both, so
 * there is one wording to keep honest instead of one per platform per
 * language. See PRIVACY_URL in packages/brand for why, and what a player can
 * still read with no connection.
 *
 * Both are the same shape as the source links beside them, including the
 * offline behaviour: tapping does nothing rather than failing loudly
 * (docs/OFFLINE_POLICY.md).
 */
const OSS_LINKS = [
  { key: 'viewSource', url: SOURCE_REPO_URL },
  { key: 'reportBug', url: `${SOURCE_REPO_URL}/issues` },
  { key: 'suggestGame', url: `${SOURCE_REPO_URL}/issues` },
  { key: 'viewLicenses', url: `${SOURCE_REPO_URL}/blob/main/LICENSE` },
  { key: 'privacyPolicy', url: PRIVACY_URL },
  { key: 'termsOfUse', url: TERMS_URL },
] as const;

export interface SettingsScreenProps {
  onBack: () => void;
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { settings, updateSettings, replaceSettings, t } = useSettings();
  const purchased = useAdRemovalPurchased();
  const purchasable = usePurchaseAvailable() && !purchased;
  /** Ads exist on this platform at all — false on the web build. */
  const adsExist = isNativeAdsPlatform();
  const [price, setPrice] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!purchasable) return;
    let cancelled = false;
    void getAdRemovalPrice().then((value) => {
      if (!cancelled) setPrice(value);
    });
    return () => {
      cancelled = true;
    };
  }, [purchasable]);

  const resetAllData = async () => {
    const keys = [...Object.values(STORAGE_KEYS), ...GAMES.flatMap((game) => game.storageKeys)];
    await clearLocalData(keys);
    // Reload the in-memory copies of the shared records from their defaults.
    replaceSettings(settingsSchema.defaultValue());
    await initAdRemoval();
    await initReview();
  };

  return (
    <div className="screen settings-screen">
      <header className="screen-header">
        <button type="button" className="icon-btn" aria-label={t('back')} onClick={onBack}>
          <IconBack />
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
                {theme === 'system'
                  ? t('themeSystem')
                  : theme === 'light'
                    ? t('themeLight')
                    : t('themeDark')}
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

        {/* Ads & support: one quiet explanation, never a popup, never pushed.
            Absent where its own text would not be true — the web build shows no
            banner and sells nothing (docs/WEB_VERSION.md). */}
        {adsExist ? (
          <section className="settings-group" aria-label={t('removeAdsTitle')}>
            <h2 className="settings-group-title">{t('removeAdsTitle')}</h2>
            {purchased ? (
              <p className="settings-note">{t('purchaseThanks')}</p>
            ) : (
              <>
                <p className="settings-note">{t('adSupportBody')}</p>
                {purchasable ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => {
                        setBusy(true);
                        void purchaseAdRemoval().finally(() => setBusy(false));
                      }}
                    >
                      {t('removeAdsAction')}
                      {price ? <span className="btn-note">{price}</span> : null}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={() => {
                        setBusy(true);
                        void restoreAdRemoval().finally(() => setBusy(false));
                      }}
                    >
                      {t('restorePurchase')}
                    </button>
                  </>
                ) : null}
              </>
            )}
          </section>
        ) : null}

        {/* Each game's own options, contributed by the game itself. */}
        {GAMES.map((game) =>
          game.SettingsSection ? <game.SettingsSection key={game.id} /> : null,
        )}

        {/* The open-source links: the promises above are verifiable in code. */}
        <section className="settings-group" aria-label={t('aboutTitle')}>
          <h2 className="settings-group-title">{t('aboutTitle')}</h2>
          {OSS_LINKS.map(({ key, url }) => (
            <button
              key={key}
              type="button"
              className="settings-row"
              onClick={() => openExternal(url)}
            >
              <span className="settings-row-label">{t(key)}</span>
              <span className="settings-row-chevron" aria-hidden="true">
                <IconChevronRight />
              </span>
            </button>
          ))}
        </section>

        <button
          type="button"
          className="settings-row settings-row-danger"
          onClick={() => setConfirmReset(true)}
        >
          <span className="settings-row-label">{t('resetData')}</span>
          <span className="settings-row-chevron" aria-hidden="true">
            <IconChevronRight />
          </span>
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
    </div>
  );
}
