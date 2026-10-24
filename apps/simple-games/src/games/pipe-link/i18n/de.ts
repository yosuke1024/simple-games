/**
 * German catalog for Pipe Link. Provenance (docs/PIPE_LINK_RULES.md §11):
 * machine-written by AI from the English source and **not read by any native
 * speaker** — not a reviewed translation. The title (`pipeLinkName`) is a
 * proper noun and stays as-is; placeholder names match the English source.
 */
import type { PipeLinkMessages } from './en';

export const de: PipeLinkMessages = {
  pipeLinkName: 'Pipe Link',
  pipeLinkChooseBoard: 'Feld wählen',
  pipeLinkDifficulty_easy: 'Leicht',
  pipeLinkDifficulty_medium: 'Mittel',
  pipeLinkDifficulty_hard: 'Schwer',
  pipeLinkBoardNote: '{width}×{height}',
  pipeLinkConfirmSwitchTitle: 'Laufendes Feld ersetzen?',
  pipeLinkConfirmSwitchBody: 'Dein Feld {current} wird durch ein neues Feld {next} ersetzt.',
  pipeLinkBoardLabel: 'Pipe-Link-Feld, {width} mal {height}',
  pipeLinkTile: 'Zeile {row}, Spalte {col}: {pipes}, {light}',
  pipeLinkTileSource: 'Zeile {row}, Spalte {col}, die Quelle: {pipes}, {light}',
  pipeLinkTileHinted: '{tile}. Tipp: drehen auf {pipes}',
  pipeLinkLit: 'leuchtet',
  pipeLinkUnlit: 'leuchtet nicht',
  pipeLinkPipes_end_0: 'Ende, offen nach oben',
  pipeLinkPipes_end_1: 'Ende, offen nach rechts',
  pipeLinkPipes_end_2: 'Ende, offen nach unten',
  pipeLinkPipes_end_3: 'Ende, offen nach links',
  pipeLinkPipes_straight_0: 'Gerade, oben und unten',
  pipeLinkPipes_straight_1: 'Gerade, links und rechts',
  pipeLinkPipes_elbow_0: 'Bogen, oben und rechts',
  pipeLinkPipes_elbow_1: 'Bogen, rechts und unten',
  pipeLinkPipes_elbow_2: 'Bogen, unten und links',
  pipeLinkPipes_elbow_3: 'Bogen, links und oben',
  pipeLinkPipes_tee_0: 'T, oben, rechts und unten',
  pipeLinkPipes_tee_1: 'T, rechts, unten und links',
  pipeLinkPipes_tee_2: 'T, unten, links und oben',
  pipeLinkPipes_tee_3: 'T, links, oben und rechts',
  pipeLinkAnnounce: 'Zeile {row}, Spalte {col}: {pipes}. {lit} von {total} Kacheln leuchten.',
  pipeLinkHintNote: 'Dreh die Kachel im gepunkteten Ring, bis ihre Rohre zu den blassen passen.',
  pipeLinkHintWhere: 'Markiert: Zeile {row}, Spalte {col}. Dreh sie auf {pipes}.',
  pipeLinkSolvedTitle: 'Alle Kacheln leuchten',
  pipeLinkSolvedBody: 'Wasser erreicht alle {tiles} Kacheln.',
  pipeLinkBoardSize: 'Feld',
  pipeLinkHintsUsed: 'Genutzte Tipps',
  pipeLinkNewBestTime: 'Deine bisher schnellste Zeit.',
  pipeLinkNewBoard: 'Neues Feld',
  pipeLinkSolvedCount: 'Gelöste Rätsel',
  pipeLinkDailySection: 'Täglich',
  pipeLinkDailiesCleared: 'Geschaffte Tage',
  pipeLinkAllModes: 'Alle Modi',
  pipeLinkStep1Title: 'Tippen zum Drehen',
  pipeLinkStep1Body:
    'Tippe auf eine Kachel, um sie eine Vierteldrehung im Uhrzeigersinn zu drehen.',
  pipeLinkStep2Title: 'Das Wasser fließt',
  pipeLinkStep2Body:
    'Rohre, die mit der Quelle verbunden sind, füllen sich mit Wasser; die anderen bleiben hohl.',
  pipeLinkStep3Title: 'Alle Rohre füllen',
  pipeLinkStep3Body: 'Sind alle Rohre voll, ist das Feld fertig.',
};
