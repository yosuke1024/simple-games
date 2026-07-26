/**
 * Settings context: loads persisted settings, applies side effects
 * (theme, language, sound, vibration, reduced motion), persists changes.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { resolveLocale, translate, type Locale, type MessageKey, type TranslateVars } from '../i18n';
import { track } from '../services/analytics';
import { setVibrationEnabled } from '../services/haptics';
import { setSoundEnabled } from '../services/sound';
import { saveRecord } from '../storage/repo';
import { settingsSchema, type Settings } from '../storage/schemas';

export interface SettingsContextValue {
  settings: Settings;
  updateSettings: (partial: Partial<Omit<Settings, 'schemaVersion'>>) => void;
  replaceSettings: (settings: Settings) => void;
  locale: Locale;
  t: (key: MessageKey, vars?: TranslateVars) => string;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function resolveTheme(settings: Settings): 'light' | 'dark' {
  if (settings.theme !== 'system') return settings.theme;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function applyDocumentEffects(settings: Settings, locale: Locale): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(settings);
  root.dataset.reducedMotion = settings.reducedMotion ? 'true' : 'false';
  root.lang = locale;
}

export function SettingsProvider({
  initialSettings,
  children,
}: {
  initialSettings: Settings;
  children: ReactNode;
}) {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const locale = resolveLocale(settings.language);

  // Side effects: services + document attributes.
  useEffect(() => {
    setSoundEnabled(settings.sound);
    setVibrationEnabled(settings.vibration);
    applyDocumentEffects(settings, locale);
  }, [settings, locale]);

  // Follow system theme changes while theme === 'system'.
  useEffect(() => {
    if (settings.theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyDocumentEffects(settings, locale);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [settings, locale]);

  const updateSettings = useCallback(
    (partial: Partial<Omit<Settings, 'schemaVersion'>>) => {
      setSettings((current) => {
        const next = { ...current, ...partial };
        void saveRecord(settingsSchema, next);
        track('settings_changed', { keys: Object.keys(partial).join(',') });
        return next;
      });
    },
    [],
  );

  /** Used by "Reset Local Data" to swap in pristine defaults without tracking. */
  const replaceSettings = useCallback((next: Settings) => {
    setSettings(next);
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: TranslateVars) => translate(locale, key, vars),
    [locale],
  );

  const value = useMemo(
    () => ({ settings, updateSettings, replaceSettings, locale, t }),
    [settings, updateSettings, replaceSettings, locale, t],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside SettingsProvider');
  return value;
}
