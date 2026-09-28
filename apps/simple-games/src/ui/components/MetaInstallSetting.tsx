/**
 * The Settings row for the Meta install measurement (issue #204,
 * docs/META_ANDROID_ACQUISITION.md): one switch and one line saying what is
 * true right now. The way to say no after having said yes, and the way to say
 * yes without waiting to be asked.
 *
 * Renders nothing in every build without Meta — the web, iOS, a debug build, a
 * release built without the flag — because there the sentence it would say is
 * not about anything. With Meta, it appears where the question can be asked
 * (English and Japanese), and also wherever the player already said yes, so a
 * change of language can never hide the way back out; the text falls back to
 * English there (metaInstallCopy.ts).
 */
import { META_ASK_LOCALES, setMetaInstallAllowed } from '../../services/acquisition/metaInstall';
import { useMetaInstallState } from '../../services/acquisition/useMetaInstall';
import { useSettings } from '../../state/SettingsContext';
import { metaInstallCopy } from './metaInstallCopy';
import { Toggle } from './Toggle';

export function MetaInstallSetting() {
  const { locale } = useSettings();
  const state = useMetaInstallState();
  if (!state.available) return null;
  const allowed = state.consent === 'granted';
  if (!allowed && !META_ASK_LOCALES.includes(locale)) return null;

  const copy = metaInstallCopy(locale);
  const note = !allowed
    ? copy.settingOff
    : state.reported
      ? copy.settingReported
      : copy.settingPending;
  return (
    <>
      <Toggle
        label={copy.settingLabel}
        checked={allowed}
        onChange={(granted) => void setMetaInstallAllowed(granted)}
      />
      <p className="settings-note">{note}</p>
    </>
  );
}
