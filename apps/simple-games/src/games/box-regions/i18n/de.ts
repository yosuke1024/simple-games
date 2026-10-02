/**
 * German catalog for Box Regions — machine translation of the English
 * source, unreviewed (docs/I18N_POLICY.md: provenance `machine`). The title
 * (`boxRegionsName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source.
 */
import type { BoxRegionsMessages } from './en';

export const de: BoxRegionsMessages = {
  boxRegionsName: 'Box Regions',
  boxRegionsChooseBoard: 'Feld wählen',
  boxRegionsDifficulty_easy: 'Leicht',
  boxRegionsDifficulty_medium: 'Mittel',
  boxRegionsDifficulty_hard: 'Schwer',
  boxRegionsBoardNote: '{width}×{height}',
  boxRegionsConfirmSwitchTitle: 'Laufendes Feld ersetzen?',
  boxRegionsConfirmSwitchBody: 'Dein Spiel {current} wird durch ein neues Feld {next} ersetzt.',
  boxRegionsBoardLabel: 'Box-Regions-Feld, {width} mal {height}',
  boxRegionsCellAssigned: 'Zeile {row}, Spalte {col}, Kasten {region}',
  boxRegionsCellEmpty: 'Zeile {row}, Spalte {col}, nicht zugeordnet',
  boxRegionsClueCount: '{count} von {size} Zellen',
  boxRegionsRuleBroken: 'verletzt eine Regel',
  boxRegionsKind_square: 'Quadratisch',
  boxRegionsKind_tall: 'Hoch',
  boxRegionsKind_wide: 'Breit',
  boxRegionsKind_free: 'Beliebiger Kasten',
  boxRegionsHintWrong: 'Der hervorgehobene Kasten passt nicht zur Lösung.',
  boxRegionsHintForced:
    'Die markierte Zelle kann nur zum Kasten der hervorgehobenen Vorgabe gehören.',
  boxRegionsHintSole: 'Dieser Kasten lässt sich nur auf eine Weise zeichnen.',
  boxRegionsHintCommon:
    'Wie der Kasten dieser Vorgabe auch gezeichnet wird, er deckt die markierten Zellen ab.',
  boxRegionsHintNone: 'Im Moment wurde kein sicherer Zug gefunden.',
  boxRegionsSolvedTitle: 'Gelöst!',
  boxRegionsSolvedBody: 'Jede Zelle liegt in ihrem Kasten.',
  boxRegionsHintsUsed: 'Genutzte Tipps',
  boxRegionsNewBestTime: 'Deine bisher schnellste Zeit.',
  boxRegionsNewBoard: 'Neues Feld',
  boxRegionsSolvedCount: 'Gelöste Rätsel',
  boxRegionsDailySection: 'Täglich',
  boxRegionsDailiesCleared: 'Abgeschlossene Tage',
  boxRegionsStep1Title: 'In Kästen teilen',
  boxRegionsStep1Body: 'Teile das Feld in Rechtecke, die jeweils genau eine Vorgabe enthalten.',
  boxRegionsStep2Title: 'Vorgaben lesen',
  boxRegionsStep2Body:
    'Die Zahl gibt an, wie viele Zellen der Kasten hat; das Symbol zeigt quadratisch, hoch, breit oder beliebig.',
  boxRegionsStep3Title: 'Von Ecke zu Ecke zeichnen',
  boxRegionsStep3Body:
    'Ziehe von einer Ecke zur gegenüberliegenden, um einen Kasten zu zeichnen. Tippe auf einen Kasten, um ihn zu entfernen. Nicht weiter? Nutze einen Tipp.',
};
