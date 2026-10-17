/**
 * Peg Solitaire — the Spanish catalog. Provenance
 * (docs/PEG_SOLITAIRE_RULES.md §15): `machine` — written by an AI from the
 * English source; no native speaker has read it. The title
 * (`pegSolitaireName`) is a proper noun and stays as-is. The boards keep the
 * word "tablero" ("Tablero inglés"), the name the 33-hole board usually goes
 * by, so the button does not read as the name of a language; the confirm
 * line puts the names in brackets so no article has to agree with them.
 */
import type { PegSolitaireMessages } from './en';

export const es: PegSolitaireMessages = {
  pegSolitaireName: 'Peg Solitaire',

  pegSolitaireBoard_english: 'Tablero inglés',
  pegSolitaireBoard_triangle: 'Tablero triangular',
  pegSolitaireBoardLabel_english: 'Tablero inglés, 33 agujeros',
  pegSolitaireBoardLabel_triangle: 'Tablero triangular, 15 agujeros',
  pegSolitaireHoleCount: '{count} agujeros',

  pegSolitaireChooseBoard: 'Elige un tablero',
  pegSolitaireBestNote: 'Menos fichas: {count}',
  pegSolitaireConfirmSwitchTitle: '¿Reemplazar la partida en curso?',
  pegSolitaireConfirmSwitchBody:
    'Tu partida en curso ({current}) se reemplazará por una partida nueva ({next}).',

  pegSolitaireHoleGrid: 'Fila {row}, columna {col}: {content}',
  pegSolitaireHoleRow: 'Fila {row}, agujero {place}: {content}',
  pegSolitaireContentPeg: 'ficha',
  pegSolitaireContentPegRing: 'ficha en el agujero con aro',
  pegSolitaireContentEmpty: 'vacío',
  pegSolitaireContentEmptyRing: 'agujero con aro, vacío',
  pegSolitaireContentLanding: 'vacío, se puede saltar aquí',
  pegSolitaireContentLandingRing: 'agujero con aro, vacío, se puede saltar aquí',

  pegSolitairePegsLeft: 'Fichas restantes: {count}',
  pegSolitaireNoJump: 'Esta ficha no puede saltar ahora.',

  pegSolitairePerfectTitle: '¡Final perfecto!',
  pegSolitairePerfectBody: 'La última ficha queda en el agujero con aro.',
  pegSolitaireSingleTitle: 'Queda una ficha',
  pegSolitaireSingleBody: 'La última ficha está fuera del agujero con aro.',
  pegSolitaireStuckTitle: 'No quedan saltos',
  pegSolitaireStuckBody: 'Ya no puede saltar ninguna ficha.',
  pegSolitairePegsLeftLabel: 'Fichas restantes',
  pegSolitaireFewestLabel: 'Mínimo del tablero',
  pegSolitaireNewFewest: 'Menos que nunca en este tablero.',
  pegSolitaireBoardFact: 'Tablero',
  pegSolitaireNewBoard: 'Tablero nuevo',

  pegSolitaireStatFewest: 'Menos fichas restantes',
  pegSolitaireStatPerfect: 'Finales perfectos',

  pegSolitaireStep1Title: 'Salta y retira',
  pegSolitaireStep1Body:
    'Salta con una ficha sobre su vecina hasta un agujero vacío: la ficha saltada se retira.',
  pegSolitaireStep2Title: 'Solo en línea recta',
  pegSolitaireStep2Body:
    'Se salta en línea recta: arriba, abajo y a los lados en el inglés, por las tres líneas en el triangular.',
  pegSolitaireStep3Title: 'Deja la última',
  pegSolitaireStep3Body:
    'Cuando ninguna ficha puede saltar, la partida termina: deja la última en el agujero con aro para un final perfecto.',
};
