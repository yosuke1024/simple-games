/**
 * Shared settings for the whole collection, plus the About block that carries
 * the brand's honesty promises: the quiet ad/support message, the one-time
 * ad-removal purchase (never pushed, shown only here), and the open-source
 * links that let anyone verify the promises in code.
 *
 * External links open the system browser; offline they simply do nothing —
 * this screen itself must always render (docs/OFFLINE_POLICY.md).
 */
import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import {
  PRIVACY_URL,
  SERIES_BY_LINE,
  SERIES_NAME,
  SOURCE_REPO_URL,
  TERMS_URL,
} from '@simple-games/brand';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import packageJson from '../../../package.json';
import { currentPlatform, pickBackupFile, saveBackupFile } from '../../backup/file';
import type { BackupProblem, PreparedRestore } from '../../backup/restore';
import { getFavoriteGames, initFavoriteGames, toggleFavoriteGame } from '../../app/favoriteGames';
import { initRecentGames } from '../../app/recentGames';
import { GAMES, type GameId } from '../../app/registry';
import { LANGUAGE_NAMES, type MessageKey } from '../../i18n';
import {
  getAdRemovalPrice,
  initAdRemoval,
  purchaseAdRemoval,
  restoreAdRemoval,
} from '../../monetization/adRemoval';
import { useAdRemovalPurchased, usePurchaseAvailable } from '../../monetization/useAdRemoval';
import { isNativeAdsPlatform } from '../../services/ads/banner';
import { showPrivacyOptions } from '../../services/ads/consent';
import { usePrivacyOptionsRequired } from '../../services/ads/useConsent';
import { initReview } from '../../services/review';
import { initWebAppPrompt } from '../../services/webAppPrompt';
import { useSettings } from '../../state/SettingsContext';
import { clearLocalData, loadRecord } from '../../storage/repo';
import {
  LANGUAGES,
  settingsSchema,
  STORAGE_KEYS,
  THEMES,
  type LanguageSetting,
  type ThemeSetting,
} from '../../storage/schemas';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IconBack, IconChevronRight, IconStar } from '../components/icons';
import { Toggle } from '../components/Toggle';
import { WebChromeSlot } from '../components/WebChromeSlot';
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

/**
 * A game's settings section is optional garnish: if its chunk fails to load
 * (Suspense does not catch a rejected lazy import), the section disappears
 * and the shared settings — including "Reset Local Data" — must stay usable.
 * Without this boundary one stale chunk would take the whole screen down.
 */
class SectionBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

// One lazy wrapper per contributed game section, reused across opens of the
// settings screen — a fresh lazy() every render would re-load and remount.
const sectionCache = new Map<GameId, ComponentType>();
function getLazySettingsSection(id: GameId): ComponentType | null {
  const cached = sectionCache.get(id);
  if (cached) return cached;
  const game = GAMES.find((entry) => entry.id === id);
  if (!game?.loadSettingsSection) return null;
  const created = lazy(game.loadSettingsSection);
  sectionCache.set(id, created);
  return created;
}

/**
 * READING AND WRITING A BACKUP ARRIVES WHEN IT IS ASKED FOR
 *
 * `backup/file.ts` is imported normally above — `pickBackupFile` has to be
 * reached inside the click's user activation, so it cannot be behind an await.
 * Everything else is loaded here, on the press: the format, the export, and
 * the validation that walks every record. None of it is needed to draw this
 * screen, and all of it would otherwise ride in the collection home's initial
 * chunk, which is the one thing the size gate measures as a promise rather
 * than a number (docs/architecture/registry.md「ゲーム単位の lazy チャンク」).
 * The types above are erased at build time and cost nothing.
 */
const loadBackupWriter = () =>
  Promise.all([import('../../backup/export'), import('../../backup/format')]);
const loadBackupReader = () => import('../../backup/restore');

/**
 * What to say about a file that was refused. Three reasons, three answers —
 * "pick another file", "update the app", "this copy is broken" — because a
 * single "could not restore" would leave somebody retrying the one thing that
 * cannot work (src/backup/restore.ts).
 */
const RESTORE_PROBLEM_MESSAGE: Record<BackupProblem, MessageKey> = {
  unreadable: 'backupFileUnreadable',
  newer: 'backupFileNewer',
  damaged: 'backupFileDamaged',
};

/**
 * The backup's date, in the reader's language, for the confirmation. Falls
 * back to the plain ISO day: knowing WHICH backup is about to replace the
 * device matters more than knowing it in the local format, and `Intl` is the
 * one thing on this screen that can throw on an unexpected tag.
 */
function backupDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export interface SettingsScreenProps {
  onBack: () => void;
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { settings, updateSettings, replaceSettings, locale, t } = useSettings();
  const purchased = useAdRemovalPurchased();
  const purchasable = usePurchaseAvailable() && !purchased;
  /** Ads exist on this platform at all — false on the web build. */
  const adsExist = isNativeAdsPlatform();
  /**
   * UMP requires a way back into the privacy options form. Only true where
   * consent law asks for it, so most players never see this row
   * (docs/ADS_POLICY.md「同意(UMP)」).
   */
  const privacyOptionsRequired = usePrivacyOptionsRequired();
  const [price, setPrice] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  /**
   * A backup that has been read and fully validated, waiting for the one
   * destructive confirmation. Holding the checked payload — rather than the
   * file — is what makes "nothing is written until the player says yes"
   * true of this screen as well as of the layer beneath it.
   */
  const [pendingRestore, setPendingRestore] = useState<PreparedRestore | null>(null);
  /** The one line Backup & Restore ever says. Cleared when a new attempt starts. */
  const [backupNotice, setBackupNotice] = useState<MessageKey | null>(null);
  // On native the installed build's real version (from the release tag, via
  // Capacitor's App.getInfo) is the source of truth — package.json's version
  // field is never bumped and would otherwise show a permanently stale
  // number. The web build has no such tag, so it keeps package.json's value.
  const [displayVersion, setDisplayVersion] = useState(packageJson.version);
  /**
   * The pinned shelf, kept here so the picker below repaints as it is used.
   * The collection home reads the same module when it mounts, which it does
   * on the way back from this screen (app/App.tsx).
   */
  const [favoriteIds, setFavoriteIds] = useState<readonly GameId[]>(getFavoriteGames);

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

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    void CapacitorApp.getInfo()
      .then((info) => {
        if (!cancelled) setDisplayVersion(info.version);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * `busy` is held for the whole delete, not just for the store calls: the
   * Favorites picker below writes to one of the records being deleted, and a
   * star tapped between `clearLocalData` finishing and `initFavoriteGames`
   * reloading would write this screen's stale in-memory shelf straight back
   * to storage — the delete would have run, and the shelf would survive it.
   */
  const resetAllData = async () => {
    setBusy(true);
    try {
      await runReset();
    } finally {
      setBusy(false);
    }
  };

  /**
   * Re-read the shared records this screen keeps in memory. Skipping one
   * would leave data that is no longer stored on screen until a restart,
   * which is whichever button just ran lying about what it did — true of
   * "Reset Local Data" and just as true of a restore.
   */
  const reloadSharedRecords = async () => {
    replaceSettings(await loadRecord(settingsSchema));
    await initRecentGames();
    await initFavoriteGames();
    setFavoriteIds(getFavoriteGames());
  };

  const runReset = async () => {
    const keys = [...Object.values(STORAGE_KEYS), ...GAMES.flatMap((game) => game.storageKeys)];
    await clearLocalData(keys);
    await reloadSharedRecords();
    // The records a backup never touches, and which only a delete resets.
    await initAdRemoval();
    await initReview();
    await initWebAppPrompt();
  };

  /**
   * Writes the backup and hands it to the platform. Nothing is said on
   * success: the OS share sheet or the browser's download is the receipt, and
   * a toast after it would be the app congratulating itself.
   */
  const exportBackup = async () => {
    setBackupNotice(null);
    setBusy(true);
    try {
      const [{ createBackup }, { backupFileName, serializeBackup }] = await loadBackupWriter();
      const backup = await createBackup({
        appVersion: displayVersion,
        platform: currentPlatform(),
      });
      const saved = await saveBackupFile(backupFileName(new Date()), serializeBackup(backup));
      if (!saved) setBackupNotice('backupExportFailed');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Opens the file picker, reads the file, and — only if every record in it
   * validates — asks the one destructive question. A file that is refused
   * never reaches the dialog, so the player is never asked to confirm
   * something that was going to fail anyway.
   *
   * Not `async`: `pickBackupFile` has to be reached inside the click's user
   * activation, and an awaited call before it would spend that (backup/file.ts).
   */
  const chooseBackup = () => {
    setBackupNotice(null);
    setBusy(true);
    const picked = pickBackupFile();
    void (async () => {
      try {
        const file = await picked;
        if (file === null) return;
        const { readBackupFile } = await loadBackupReader();
        const read = await readBackupFile(file);
        if (read.ok) setPendingRestore(read.prepared);
        else setBackupNotice(RESTORE_PROBLEM_MESSAGE[read.problem]);
      } finally {
        setBusy(false);
      }
    })();
  };

  const runRestore = async (prepared: PreparedRestore) => {
    setBusy(true);
    try {
      const { applyBackup } = await loadBackupReader();
      const outcome = await applyBackup(prepared);
      // On either outcome the store now holds what the player should see: the
      // backup's records, or — after a rollback — the ones they started with.
      await reloadSharedRecords();
      setBackupNotice(outcome === 'restored' ? 'backupRestoreDone' : 'backupRestoreFailed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen settings-screen">
      {/* Web build only — the shared PixApps header (docs/WEB_VERSION.md
          「サイトクローム」). Renders nothing on the native app. */}
      <WebChromeSlot />

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

        {/* Pinning, the way that does not depend on a gesture. The collection
            home opens the same choice from a long press or a right-click
            (ui/components/GameActionSheet.tsx), which is quicker but is
            neither discoverable nor reachable from a keyboard — so this list
            is the one that has to exist, not the convenience (issue #109).

            Every game, in registry order, as a pressed/unpressed star. No
            counts and no times beside them: what is pinned is a choice, and
            this screen is where it is made, not where play is reported. */}
        <section className="settings-group" aria-label={t('favoritesHeading')}>
          <h2 className="settings-group-title">{t('favoritesHeading')}</h2>
          <div className="favorite-picker">
            {GAMES.map((game) => {
              const isFavorite = favoriteIds.includes(game.id);
              return (
                <button
                  key={game.id}
                  type="button"
                  className={`favorite-pick ${isFavorite ? 'favorite-pick-on' : ''}`}
                  aria-pressed={isFavorite}
                  // Off while "Reset Local Data" is deleting: see resetAllData.
                  disabled={busy}
                  onClick={() => setFavoriteIds(toggleFavoriteGame(game.id))}
                >
                  <span className="favorite-pick-title">{game.title}</span>
                  <span className="favorite-pick-star" aria-hidden="true">
                    <IconStar filled={isFavorite} />
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Each game's own options, contributed by the game itself. Lazy —
            the section rides in the game's chunk — behind a null fallback,
            which matches the sections' own render-null-until-loaded shape. */}
        {GAMES.map((game) => {
          const Section = getLazySettingsSection(game.id);
          return Section ? (
            <SectionBoundary key={game.id}>
              <Suspense fallback={null}>
                <Section />
              </Suspense>
            </SectionBoundary>
          ) : null;
        })}

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
          {/* Reopens Google's consent form. Placed beside the privacy policy
              because that is what it is — a privacy control, not an ad
              setting — and rendered only where UMP says an entry point is
              required, so it never appears as an unexplained extra row. */}
          {privacyOptionsRequired ? (
            <button
              type="button"
              className="settings-row"
              onClick={() => void showPrivacyOptions()}
            >
              <span className="settings-row-label">{t('adPrivacyOptions')}</span>
              <span className="settings-row-chevron" aria-hidden="true">
                <IconChevronRight />
              </span>
            </button>
          ) : null}
        </section>

        {/* Backup & Restore (issue #160). Simple Games keeps no account and
            no cloud save, so a file the player moves themselves is the whole
            of "I got a new phone" — and the only thing the app does is write
            it and read it back (docs/architecture/backup.md).

            No badge, no "you have not backed up in 30 days", no reminder.
            Two buttons that do what they say, and one line of text when
            there is something true to say (docs/PRODUCT_PRINCIPLES.md). */}
        <section className="settings-group" aria-label={t('backupTitle')}>
          <h2 className="settings-group-title">{t('backupTitle')}</h2>
          <p className="settings-note">{t('backupBody')}</p>
          <p className="settings-note">{t('backupPrivacyNote')}</p>
          {/* Only where a purchase exists to be misunderstood — the web build
              sells nothing (docs/WEB_VERSION.md). */}
          {adsExist ? <p className="settings-note">{t('backupPurchaseNote')}</p> : null}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => void exportBackup()}
          >
            {t('backupExport')}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={chooseBackup}>
            {t('backupRestore')}
          </button>
          {/* `role="status"` so the outcome is announced rather than only
              drawn: this is the one place on the screen where something
              happened that has no other visible trace. */}
          {backupNotice ? (
            <p className="settings-status" role="status">
              {t(backupNotice)}
            </p>
          ) : null}
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
          <span className="settings-row-value">{displayVersion}</span>
        </div>
      </div>

      <footer className="brand-footer">
        <span className="brand-name">{SERIES_NAME}</span>
        <span className="brand-by">{SERIES_BY_LINE}</span>
      </footer>

      {/* Asked only about a file that has already been read and validated in
          full, and answered before a single byte of the device's data is
          written (src/backup/restore.ts). */}
      <ConfirmDialog
        open={pendingRestore !== null}
        title={t('backupRestoreConfirmTitle')}
        body={
          pendingRestore
            ? t('backupRestoreConfirmBody', { date: backupDate(pendingRestore.createdAt, locale) })
            : undefined
        }
        cancelLabel={t('cancel')}
        confirmLabel={t('backupRestore')}
        danger
        onCancel={() => setPendingRestore(null)}
        onConfirm={() => {
          const prepared = pendingRestore;
          setPendingRestore(null);
          if (prepared) void runRestore(prepared);
        }}
      />

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
