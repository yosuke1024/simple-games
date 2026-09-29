/**
 * de catalog for Binary Balance: a machine translation of the English
 * source, not yet reviewed by a native speaker (docs/I18N_POLICY.md). The
 * title (`binaryBalanceName`) is a proper noun and stays as-is; wording follows
 * the Takuzu catalog where the meaning is the same. The two marks are a sun
 * and a moon (the ordinary words for the celestial bodies).
 */
import type { BinaryBalanceMessages } from './en';

export const de: BinaryBalanceMessages = {
  binaryBalanceName: 'Binary Balance',
  binaryBalanceChooseBoard: 'Feld wählen',
  binaryBalanceDifficulty_easy: 'Leicht',
  binaryBalanceDifficulty_medium: 'Mittel',
  binaryBalanceDifficulty_hard: 'Schwer',
  binaryBalanceBoardNote: '{size}×{size}',
  binaryBalanceConfirmSwitchTitle: 'Laufendes Feld ersetzen?',
  binaryBalanceConfirmSwitchBody: 'Dein Spiel {current} wird durch ein neues Feld {next} ersetzt.',
  binaryBalanceBoardLabel: 'Binary-Balance-Feld, {size} mal {size}',
  binaryBalanceCellEmpty: 'Leer, Zeile {row}, Spalte {col}',
  binaryBalanceCellSun: 'Sonne, Zeile {row}, Spalte {col}',
  binaryBalanceCellMoon: 'Mond, Zeile {row}, Spalte {col}',
  binaryBalanceCellFixedSun: 'Sonne, vorgegeben, Zeile {row}, Spalte {col}',
  binaryBalanceCellFixedMoon: 'Mond, vorgegeben, Zeile {row}, Spalte {col}',
  binaryBalanceLinkSameRight: 'gleich wie das Feld rechts',
  binaryBalanceLinkDiffRight: 'anders als das Feld rechts',
  binaryBalanceLinkSameBelow: 'gleich wie das Feld darunter',
  binaryBalanceLinkDiffBelow: 'anders als das Feld darunter',
  binaryBalanceRuleBroken: 'verstößt gegen eine Regel',
  binaryBalanceMarkSun: 'eine Sonne',
  binaryBalanceMarkMoon: 'ein Mond',
  binaryBalanceHintViolation: 'Die hervorgehobenen Felder verstoßen gegen eine Regel.',
  binaryBalanceHintWrong: 'Das umrandete Zeichen kann nicht stimmen.',
  binaryBalanceHintPairGap:
    'Das getönte Paar ergäbe drei in Folge, also ist das umrandete Feld {mark}.',
  binaryBalanceHintLineCount:
    'Die hervorgehobene Linie enthält ihre Hälfte des getönten Zeichens schon, also ist das umrandete Feld {mark}.',
  binaryBalanceHintLinkSame:
    'Ein = verbindet das umrandete Feld mit dem getönten, also ist es ebenfalls {mark}.',
  binaryBalanceHintLinkDiff:
    'Ein × verbindet das umrandete Feld mit dem getönten, also bekommt es das andere Zeichen: {mark}.',
  binaryBalanceHintLineCompletion:
    'Jede Art, die hervorgehobene Linie zu vervollständigen, setzt {mark} in das umrandete Feld.',
  binaryBalanceHintHypothesis:
    'Wäre das umrandete Feld {other}, würden die folgenden Züge gegen eine Regel verstoßen, also ist es {mark}.',
  binaryBalanceHintNone: 'Gerade ist kein sicherer Zug zu finden.',
  binaryBalanceSolvedTitle: 'Gelöst!',
  binaryBalanceSolvedBody: 'Alle Linien sind ausgeglichen, und alle Verbindungen stimmen.',
  binaryBalanceHintsUsed: 'Verwendete Hinweise',
  binaryBalanceNewBestTime: 'Deine schnellste Zeit.',
  binaryBalanceNewBoard: 'Neues Feld',
  binaryBalanceDailySection: 'Tagesrätsel',
  binaryBalanceDailiesSolved: 'Gelöste Tage',
  binaryBalanceDailyBacklogHint: 'Jeder frühere Tag bleibt offen.',
  binaryBalanceStep1Title: 'Nie drei in Folge',
  binaryBalanceStep1Body:
    'Tippen wechselt zwischen leer, Sonne und Mond. Dasselbe Zeichen steht nie dreimal in Folge.',
  binaryBalanceStep2Title: 'Halbe-halbe',
  binaryBalanceStep2Body: 'Jede Zeile und jede Spalte enthält gleich viele Sonnen wie Monde.',
  binaryBalanceStep3Title: 'Den Verbindungen folgen',
  binaryBalanceStep3Body:
    'Felder mit = sind gleich, Felder mit × sind verschieden. Hängst du fest? Frag nach einem Hinweis.',
};
