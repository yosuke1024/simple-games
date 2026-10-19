/**
 * German catalog for Bridges. Provenance (docs/BRIDGES_RULES.md §14,
 * docs/I18N_POLICY.md): `machine` — written with AI assistance and **not read
 * by a native speaker**. The title (`bridgesName`) is a proper noun and stays
 * as-is in every locale; placeholder names match the English source.
 */
import type { BridgesMessages } from './en';

export const de: BridgesMessages = {
  bridgesName: 'Bridges',
  bridgesChooseBoard: 'Feld wählen',
  bridgesDifficulty_easy: 'Leicht',
  bridgesDifficulty_medium: 'Mittel',
  bridgesDifficulty_hard: 'Schwer',
  bridgesBoardNote: '{width}×{height}',
  bridgesConfirmSwitchTitle: 'Laufendes Feld ersetzen?',
  bridgesConfirmSwitchBody: 'Dein Feld {current} wird durch ein neues Feld {next} ersetzt.',
  bridgesBoardLabel: 'Bridges-Feld, {width} mal {height}, {islands} Inseln',
  bridgesIslandOpen: 'Insel {value}, Zeile {row}, Spalte {col}: {count} von {value} Brücken',
  bridgesIslandComplete: 'Insel {value}, Zeile {row}, Spalte {col}: vollständig',
  bridgesIslandOver: 'Insel {value}, Zeile {row}, Spalte {col}: {count} Brücken, zu viele',
  bridgesIslandSelected: '{island}. Ausgewählt',
  bridgesIslandPartner: '{island}. Mit der ausgewählten Insel verbindbar: {bridges} von 2 Brücken',
  bridgesIslandHinted: '{island}. Vom Tipp markiert',
  bridgesIslandHintRing: '{island}. Vom Tipp markiert, im gepunkteten Ring',
  bridgesAnnounceNone:
    'Keine Brücke zwischen Zeile {row1}, Spalte {col1} und Zeile {row2}, Spalte {col2}',
  bridgesAnnounceOne:
    'Eine Brücke zwischen Zeile {row1}, Spalte {col1} und Zeile {row2}, Spalte {col2}',
  bridgesAnnounceTwo:
    'Zwei Brücken zwischen Zeile {row1}, Spalte {col1} und Zeile {row2}, Spalte {col2}',
  bridgesSplitNote:
    'Alle Zahlen stimmen, aber die Inseln bilden {groups} Gruppen. Verbinde sie zu einer.',
  bridgesHintWrong: 'Zu viele Brücken zwischen den markierten Inseln.',
  bridgesHintOne: 'Das markierte Paar braucht mindestens eine Brücke.',
  bridgesHintTwo: 'Das markierte Paar braucht zwei Brücken.',
  bridgesHintOneAt:
    'Zähl an der Insel im gepunkteten Ring nach: Das markierte Paar braucht mindestens eine Brücke.',
  bridgesHintTwoAt:
    'Zähl an der Insel im gepunkteten Ring nach: Das markierte Paar braucht zwei Brücken.',
  bridgesHintNone: 'Von hier aus kein sicherer Schritt gefunden.',
  bridgesHintWhere: 'Markiert: Zeile {row1}, Spalte {col1} und Zeile {row2}, Spalte {col2}.',
  bridgesHintWhereRing:
    'Markiert: Zeile {row1}, Spalte {col1} und Zeile {row2}, Spalte {col2}. Gepunkteter Ring: Zeile {row}, Spalte {col}.',
  bridgesSolvedTitle: 'Alles verbunden!',
  bridgesSolvedBody: 'Alle Inseln bilden ein einziges Netz.',
  bridgesHintsUsed: 'Genutzte Tipps',
  bridgesNewBestTime: 'Deine bisher schnellste Zeit.',
  bridgesNewBoard: 'Neues Feld',
  bridgesSolvedCount: 'Gelöste Rätsel',
  bridgesDailySection: 'Täglich',
  bridgesDailiesCleared: 'Geschaffte Tage',
  bridgesAllModes: 'Alle Modi',
  bridgesStep1Title: 'Zahlen sind Brücken',
  bridgesStep1Body: 'Jede Insel bekommt genau so viele Brücken, wie ihre Zahl angibt.',
  bridgesStep2Title: 'Gerade, höchstens zwei',
  bridgesStep2Body:
    'Brücken verlaufen gerade waagerecht oder senkrecht, kreuzen sich nie, und zwischen zwei Inseln liegen höchstens zwei.',
  bridgesStep3Title: 'Alle verbinden',
  bridgesStep3Body:
    'Tippe eine Insel und dann eine Insel mit Ring an, um eine Brücke zu bauen (erneut für zwei, erneut für keine), bis alle verbunden sind.',
};
