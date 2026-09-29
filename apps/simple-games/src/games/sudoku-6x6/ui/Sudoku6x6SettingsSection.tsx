/**
 * Sudoku 6×6's own setting, contributed to the shared settings screen
 * (docs/SUDOKU_6X6_RULES.md §4): whether a wrong digit is marked the moment it
 * lands. Repeated digits are marked either way — that is the rule, not the
 * answer.
 *
 * The game owns the record (`s6.prefs`); the shell only gives it a place to
 * appear. Settings are only reachable from the collection home, so no game is
 * mounted while this is on screen — reading and writing the record here
 * cannot race a running game.
 */
// Register this game's 14-locale catalog the moment the chunk loads,
// before anything below renders (issue #38, src/i18n/registry.ts).
import '../i18n';
import { useEffect, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { Toggle } from '@/ui/components/Toggle';
import { loadRecord, saveRecord } from '../../../storage/repo';
import { prefsSchema, type Prefs } from '../storage/schemas';

export function Sudoku6x6SettingsSection() {
  const { t } = useSettings();
  const [prefs, setPrefs] = useState<Prefs | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadRecord(prefsSchema).then((loaded) => {
      if (!cancelled) setPrefs(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (prefs === null) return null;

  return (
    <section className="settings-group" aria-label={t('sudoku6x6Name')}>
      <h2 className="settings-group-title">{t('sudoku6x6Name')}</h2>
      <Toggle
        label={t('sudoku6x6HighlightMistakes')}
        checked={prefs.highlightMistakes}
        onChange={(highlightMistakes) => {
          const next = { ...prefs, highlightMistakes };
          setPrefs(next);
          void saveRecord(prefsSchema, next);
        }}
      />
      <p className="settings-note">{t('sudoku6x6HighlightMistakesNote')}</p>
    </section>
  );
}
