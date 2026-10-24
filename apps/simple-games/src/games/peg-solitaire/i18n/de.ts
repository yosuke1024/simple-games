/**
 * Peg Solitaire — the German catalog. Provenance
 * (docs/PEG_SOLITAIRE_RULES.md §15): `machine` — written by an AI from the
 * English source; no native speaker has read it. The title
 * (`pegSolitaireName`) is a proper noun and stays as-is. The boards keep the
 * word "Brett" ("Englisches Brett", the usual name of the 33-hole board), so
 * the button does not read as the name of a language; the confirm line puts
 * the names in brackets so no article has to agree with them.
 */
import type { PegSolitaireMessages } from './en';

export const de: PegSolitaireMessages = {
  pegSolitaireName: 'Peg Solitaire',

  pegSolitaireBoard_english: 'Englisches Brett',
  pegSolitaireBoard_triangle: 'Dreiecksbrett',
  pegSolitaireBoardLabel_english: 'Englisches Brett, 33 Löcher',
  pegSolitaireBoardLabel_triangle: 'Dreiecksbrett, 15 Löcher',
  pegSolitaireHoleCount: '{count} Löcher',

  pegSolitaireChooseBoard: 'Brett wählen',
  pegSolitaireBestNote: 'Wenigste Stifte: {count}',
  pegSolitaireConfirmSwitchTitle: 'Laufendes Spiel ersetzen?',
  pegSolitaireConfirmSwitchBody:
    'Dein laufendes Spiel ({current}) wird durch ein neues Spiel ({next}) ersetzt.',

  pegSolitaireHoleGrid: 'Zeile {row}, Spalte {col}: {content}',
  pegSolitaireHoleRow: 'Zeile {row}, Loch {place}: {content}',
  pegSolitaireContentPeg: 'Stift',
  pegSolitaireContentPegRing: 'Stift im Loch mit Ring',
  pegSolitaireContentEmpty: 'leer',
  pegSolitaireContentEmptyRing: 'Loch mit Ring, leer',
  pegSolitaireContentLanding: 'leer, hier kann ein Sprung landen',
  pegSolitaireContentLandingRing: 'Loch mit Ring, leer, hier kann ein Sprung landen',

  pegSolitairePegsLeft: 'Übrige Stifte: {count}',
  pegSolitaireNoJump: 'Dieser Stift kann gerade nicht springen.',

  pegSolitairePerfectTitle: 'Perfekt gelöst!',
  pegSolitairePerfectBody: 'Der letzte Stift steht im Loch mit Ring.',
  pegSolitaireSingleTitle: 'Ein Stift übrig',
  pegSolitaireSingleBody: 'Der letzte Stift steht außerhalb des Lochs mit Ring.',
  pegSolitaireStuckTitle: 'Keine Sprünge mehr',
  pegSolitaireStuckBody: 'Kein Stift kann mehr springen.',
  pegSolitairePegsLeftLabel: 'Übrige Stifte',
  pegSolitaireFewestLabel: 'Wenigste auf diesem Brett',
  pegSolitaireNewFewest: 'So wenige wie nie auf diesem Brett.',
  pegSolitaireBoardFact: 'Brett',
  pegSolitaireNewBoard: 'Neues Brett',

  pegSolitaireStatFewest: 'Wenigste übrige Stifte',
  pegSolitaireStatPerfect: 'Perfekt gelöst',

  pegSolitaireStep1Title: 'Springen und entfernen',
  pegSolitaireStep1Body:
    'Lass einen Stift über seinen Nachbarn in ein leeres Loch springen – der übersprungene Stift wird entfernt.',
  pegSolitaireStep2Title: 'Nur gerade Linien',
  pegSolitaireStep2Body:
    'Gesprungen wird gerade: auf dem englischen Brett hoch, runter und seitwärts, auf dem Dreiecksbrett entlang der drei Linien.',
  pegSolitaireStep3Title: 'Den letzten übrig lassen',
  pegSolitaireStep3Body:
    'Kann kein Stift mehr springen, ist das Spiel vorbei – bleibt der letzte im Loch mit Ring stehen, ist es perfekt gelöst.',
};
