/**
 * Sudoku's own settings, contributed to the shared settings screen.
 *
 * The game owns the record (`sd.prefs`); the shell only gives it a place to
 * appear, so a game's options live with the game rather than in a shell that
 * would have to know about every title. Settings are only reachable from the
 * collection home, so no game is mounted while this is on screen — reading and
 * writing the record here cannot race a running game.
 */
// Register this game's 14-locale catalog the moment the chunk loads,
// before anything below renders (issue #38, src/i18n/registry.ts).
import '../i18n';
import { useEffect, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { Toggle } from '@/ui/components/Toggle';
import { loadRecord, saveRecord } from '../../../storage/repo';
import { prefsSchema, type Prefs } from '../storage/schemas';

export function SudokuSettingsSection() {
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
    <section className="settings-group" aria-label={t('sudokuName')}>
      <h2 className="settings-group-title">{t('sudokuName')}</h2>
      <Toggle
        label={t('sudokuHighlightMistakes')}
        checked={prefs.highlightMistakes}
        onChange={(highlightMistakes) => {
          const next = { ...prefs, highlightMistakes };
          setPrefs(next);
          void saveRecord(prefsSchema, next);
        }}
      />
      <p className="settings-note">{t('sudokuHighlightMistakesNote')}</p>
    </section>
  );
}
