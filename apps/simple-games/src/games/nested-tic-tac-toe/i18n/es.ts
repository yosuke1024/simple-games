/**
 * Nested Tic-Tac-Toe — the Spanish catalog. Provenance
 * (docs/NESTED_TIC_TAC_TOE_RULES.md §12): `machine` — written by an AI from
 * the English source on 2026-10-21; no native speaker has read it. The title
 * (`nestedTicTacToeName`) is a proper noun and stays as-is.
 *
 * Glossary (§12), one word each: small board = tablero pequeño · square =
 * casilla · send = enviar · take / taken = tomar / tomado (never "ganar",
 * which is the match) · closed = cerrado · open = abierto · first / second =
 * Primero / Segundo · cross / circle = cruz / círculo. The record note puts
 * each number after its label, as the English does, so a count of 1 needs no
 * singular.
 */
import type { NestedTicTacToeMessages } from './en';

export const es: NestedTicTacToeMessages = {
  nestedTicTacToeName: 'Nested Tic-Tac-Toe',
  nestedTicTacToeChooseOpponent: 'Elige a tu rival',
  nestedTicTacToeDifficulty_easy: 'Fácil',
  nestedTicTacToeDifficulty_normal: 'Normal',
  nestedTicTacToeDifficulty_hard: 'Difícil',
  nestedTicTacToeRecordNote: 'Victorias {wins} · Derrotas {losses}',
  nestedTicTacToeChooseSideLabel: 'Quién empieza',
  nestedTicTacToePlayFirst: 'Primero',
  nestedTicTacToePlaySecond: 'Segundo',
  nestedTicTacToePlayFirstLabel: 'Primero, con la cruz',
  nestedTicTacToePlaySecondLabel: 'Segundo, con el círculo',
  nestedTicTacToeConfirmSwitchTitle: '¿Reemplazar la partida en curso?',
  nestedTicTacToeConfirmSwitchBody:
    'Tu partida {current} se reemplazará por una nueva partida {next}.',
  nestedTicTacToeBoardLabel: 'Tablero de Nested Tic-Tac-Toe, nueve tableros pequeños',
  nestedTicTacToeSmallOpen: 'Tablero pequeño {board}: abierto',
  nestedTicTacToeSmallPlayable: 'Tablero pequeño {board}: abierto, juega aquí',
  nestedTicTacToeSmallMine: 'Tablero pequeño {board}: tomado por ti',
  nestedTicTacToeSmallCpu: 'Tablero pequeño {board}: tomado por la CPU',
  nestedTicTacToeSmallDrawn: 'Tablero pequeño {board}: empate (cerrado)',
  nestedTicTacToeCellEmpty: 'Tablero pequeño {board}, casilla {square}: vacía',
  nestedTicTacToeCellPlayable: 'Tablero pequeño {board}, casilla {square}: juega aquí',
  nestedTicTacToeCellYourCross: 'Tablero pequeño {board}, casilla {square}: tu cruz',
  nestedTicTacToeCellYourCircle: 'Tablero pequeño {board}, casilla {square}: tu círculo',
  nestedTicTacToeCellCpuCross: 'Tablero pequeño {board}, casilla {square}: cruz de la CPU',
  nestedTicTacToeCellCpuCircle: 'Tablero pequeño {board}, casilla {square}: círculo de la CPU',
  nestedTicTacToeYourTurnSent: 'Tu turno: juega en el tablero enmarcado',
  nestedTicTacToeYourTurnFree: 'Tu turno: juega en cualquier tablero abierto',
  nestedTicTacToeCpuTurn: 'Turno de la CPU',
  nestedTicTacToeWinTitle: 'Ganaste',
  nestedTicTacToeWinBody: 'Tres de tus tableros en línea.',
  nestedTicTacToeLoseTitle: 'Gana la CPU',
  nestedTicTacToeLoseBody: 'La CPU tomó tres tableros en línea.',
  nestedTicTacToeDrawTitle: 'Empate',
  nestedTicTacToeDrawBody:
    'Todos los tableros pequeños se cerraron y nadie tiene tres tableros en línea.',
  nestedTicTacToeBoardsYou: 'Tus tableros',
  nestedTicTacToeBoardsCpu: 'Tableros de la CPU',
  nestedTicTacToeWins: 'Victorias',
  nestedTicTacToeLosses: 'Derrotas',
  nestedTicTacToeDraws: 'Empates',
  nestedTicTacToeStep1Title: 'Tu jugada envía al rival',
  nestedTicTacToeStep1Body:
    'La casilla donde juegas dentro de un tablero pequeño decide en qué tablero juega tu rival después.',
  nestedTicTacToeStep2Title: 'Tomado o lleno: cualquier tablero abierto',
  nestedTicTacToeStep2Body:
    'Si ese tablero está tomado o lleno, juega en cualquier tablero abierto.',
  nestedTicTacToeStep3Title: 'Tres tableros en línea',
  nestedTicTacToeStep3Body:
    'Hacer tres en línea toma un tablero pequeño; tres tableros tomados en línea ganan la partida.',
};
