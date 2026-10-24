/**
 * German catalog for Make the Target — written by AI from the English source
 * on 2026-10-21 (provenance `machine`, docs/MAKE_THE_TARGET_RULES.md §13). No
 * native speaker has read it; it is not to be treated as reviewed. The title
 * (`makeTheTargetName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source.
 *
 * Terms: problem = Aufgabe, target = Zielzahl (not Tor or Punkte), solution =
 * Lösung, the result of one move = Ergebnis. Division is read "geteilt durch",
 * left term first. Shared words follow the shell and Bridges (Leicht / Mittel /
 * Schwer, Täglich, Geschaffte Tage).
 */
import type { MakeTheTargetMessages } from './en';

export const de: MakeTheTargetMessages = {
  makeTheTargetName: 'Make the Target',
  makeTheTargetChooseTier: 'Schwierigkeit wählen',
  makeTheTargetDifficulty_easy: 'Leicht',
  makeTheTargetDifficulty_medium: 'Mittel',
  makeTheTargetDifficulty_hard: 'Schwer',
  makeTheTargetTierNote_easy: '4 Zahlen',
  makeTheTargetTierNote_medium: '4 oder 5 Zahlen',
  makeTheTargetTierNote_hard: '5 Zahlen',
  makeTheTargetConfirmSwitchTitle: 'Laufende Aufgabe ersetzen?',
  makeTheTargetConfirmSwitchBody:
    'Deine Aufgabe {current} wird durch eine neue Aufgabe {next} ersetzt.',
  makeTheTargetNumbersLabel: 'Zahlen',
  makeTheTargetTargetSpoken: 'Zielzahl {target}',
  makeTheTargetTargetLabel: 'Zielzahl',
  makeTheTargetOperatorsLabel: 'Rechenzeichen',
  makeTheTargetOp_add: 'Addieren',
  makeTheTargetOp_subtract: 'Subtrahieren',
  makeTheTargetOp_multiply: 'Multiplizieren',
  makeTheTargetOp_divide: 'Dividieren',
  makeTheTargetSpokenLine_add: '{left} plus {right} gleich {result}',
  makeTheTargetSpokenLine_subtract: '{left} minus {right} gleich {result}',
  makeTheTargetSpokenLine_multiply: '{left} mal {right} gleich {result}',
  makeTheTargetSpokenLine_divide: '{left} geteilt durch {right} gleich {result}',
  makeTheTargetSpokenUndo: 'Zurückgenommen: {line}',
  makeTheTargetStepsLabel: 'Bisherige Rechenschritte',
  makeTheTargetMissed: 'Das ergibt {value}, nicht {target}.',
  makeTheTargetSpokenMissed: '{line}. Das ergibt {value}, nicht {target}.',
  makeTheTargetShowSolution: 'Lösung zeigen',
  makeTheTargetRevealTitle: 'Eine Lösung zeigen?',
  makeTheTargetRevealBody: 'Diese Aufgabe endet hier und zählt nicht als gelöst.',
  makeTheTargetRevealConfirm: 'Zeigen',
  makeTheTargetSolvedTitle: 'Zielzahl erreicht.',
  makeTheTargetRevealedTitle: 'Ein Weg, {target} zu bilden',
  makeTheTargetSolutionLabel: 'Eine Lösung',
  makeTheTargetNewBoard: 'Neue Aufgabe',
  makeTheTargetNewBestTime: 'Deine bisher schnellste Zeit.',
  makeTheTargetSolvedCount: 'Gelöste Aufgaben',
  makeTheTargetDailySection: 'Täglich',
  makeTheTargetDailiesCleared: 'Geschaffte Tage',
  makeTheTargetAllModes: 'Alle Modi',
  makeTheTargetStep1Title: 'Zwei kombinieren',
  makeTheTargetStep1Body:
    'Tippe eine Zahl, dann + − × oder ÷, dann eine zweite Zahl\u00a0– die zuerst getippte steht links.',
  makeTheTargetStep2Title: 'Eine neue Zahl',
  makeTheTargetStep2Body:
    'Die beiden sind verbraucht, und das Ergebnis\u00a0– immer eine ganze Zahl größer als null\u00a0– tritt an ihre Stelle.',
  makeTheTargetStep3Title: 'Die Zielzahl treffen',
  makeTheTargetStep3Body:
    'Nutze alle Zahlen. Ist die letzte gleich der Zielzahl, ist die Aufgabe gelöst.',
};
