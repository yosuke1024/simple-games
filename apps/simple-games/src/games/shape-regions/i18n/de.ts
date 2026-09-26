/**
 * German catalog for Shape Regions (docs/I18N_POLICY.md: provenance
 * `machine`). The title (`shapeRegionsName`) is a proper noun and stays
 * as-is in every locale; placeholder names match the English source.
 */
import type { ShapeRegionsMessages } from './en';

export const de: ShapeRegionsMessages = {
  shapeRegionsName: 'Shape Regions',
  shapeRegionsChooseBoard: 'Brett wählen',
  shapeRegionsDifficulty_easy: 'Leicht',
  shapeRegionsDifficulty_medium: 'Mittel',
  shapeRegionsDifficulty_hard: 'Schwer',
  shapeRegionsBoardNote: '{width}×{height}',
  shapeRegionsConfirmSwitchTitle: 'Laufendes Brett ersetzen?',
  shapeRegionsConfirmSwitchBody: 'Dein {current}-Spiel wird durch ein neues {next}-Brett ersetzt.',
  shapeRegionsBoardLabel: 'Shape-Regions-Brett, {width} mal {height}',
  shapeRegionsCellAssigned: 'Zeile {row}, Spalte {col}, Form {region}',
  shapeRegionsCellEmpty: 'Zeile {row}, Spalte {col}, nicht zugeordnet',
  shapeRegionsClueCount: '{count} von {size} Feldern',
  shapeRegionsRuleBroken: 'verletzt eine Regel',
  shapeRegionsShape_line: 'Linie',
  shapeRegionsShape_block: 'Rechteck',
  shapeRegionsShape_corner: 'Ecke',
  shapeRegionsShape_tee: 'T-Form',
  shapeRegionsShape_step: 'Stufe',
  shapeRegionsHintWrong: 'Die hervorgehobene Form passt nicht zur Lösung.',
  shapeRegionsHintForced: 'Das markierte Feld kann nur zur hervorgehobenen Form gehören.',
  shapeRegionsHintSole: 'Die hervorgehobene Form hat nur eine mögliche Lage.',
  shapeRegionsHintCommon:
    'Wie die hervorgehobene Form auch liegt, sie enthält die markierten Felder.',
  shapeRegionsHintNone: 'Gerade kein sicherer Zug gefunden.',
  shapeRegionsSolvedTitle: 'Gelöst!',
  shapeRegionsSolvedBody: 'Jedes Feld gehört zu seiner Form.',
  shapeRegionsHintsUsed: 'Hinweise genutzt',
  shapeRegionsNewBestTime: 'Deine Bestzeit.',
  shapeRegionsNewBoard: 'Neues Brett',
  shapeRegionsSolvedCount: 'Gelöste Rätsel',
  shapeRegionsDailySection: 'Täglich',
  shapeRegionsDailiesCleared: 'Geschaffte Tage',
  shapeRegionsDailyBacklogHint: 'Jeder frühere Tag bleibt offen.',
  shapeRegionsStep1Title: 'Zahl und Symbol',
  shapeRegionsStep1Body:
    'Die Zahl sagt, wie viele Felder die Form hat; das Symbol zeigt ihre Gestalt.',
  shapeRegionsStep2Title: 'Vom Hinweis aus wachsen',
  shapeRegionsStep2Body:
    'Ziehe von einem Hinweis über Nachbarfelder, um seine Form wachsen zu lassen.',
  shapeRegionsStep3Title: 'Das Brett füllen',
  shapeRegionsStep3Body:
    'Am Ende gehört jedes Feld zu einer Form. Tippe ein Feld an, um es zu entfernen.',
};
