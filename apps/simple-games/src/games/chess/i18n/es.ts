/**
 * Chess — the Spanish catalog. Provenance (docs/CHESS_RULES.md §10): `machine` —
 * written by an AI from the English source on 2026-10-22; no native speaker
 * has read it, and neither has the author. The title (`chessName`) is a
 * proper noun and stays as-is.
 *
 * Glossary (§10.1): jaque · jaque mate · ahogado (never "mate") · tablas · material insuficiente · triple repetición · regla de los 50 movimientos; peón · caballo · alfil · torre · dama · rey; blancas · negras. The colour agrees with each piece in the twelve piece keys (peón blanco, dama blanca).
 */
import type { ChessMessages } from './en';

export const es: ChessMessages = {
  chessName: 'Chess',
  chessChooseOpponent: 'Elige a tu rival',
  chessDifficulty_easy: 'Fácil',
  chessDifficulty_normal: 'Normal',
  chessDifficulty_hard: 'Difícil',
  chessRecordNote: 'Victorias {wins} · Tablas {draws} · Derrotas {losses}',
  chessChooseSideLabel: 'Tu color en la próxima partida',
  chessPlayWhite: 'Blancas (mueven primero)',
  chessPlayBlack: 'Negras (mueven segundo)',
  chessConfirmSwitchTitle: '¿Reemplazar la partida en curso?',
  chessConfirmSwitchBody: 'Tu partida ({current}) se reemplazará por una nueva partida ({next}).',
  chessYouPlayWhite: 'Juegas con blancas',
  chessYouPlayBlack: 'Juegas con negras',
  chessBoardLabel: 'Tablero de ajedrez',
  chessPiece_white_pawn: 'peón blanco',
  chessPiece_white_knight: 'caballo blanco',
  chessPiece_white_bishop: 'alfil blanco',
  chessPiece_white_rook: 'torre blanca',
  chessPiece_white_queen: 'dama blanca',
  chessPiece_white_king: 'rey blanco',
  chessPiece_black_pawn: 'peón negro',
  chessPiece_black_knight: 'caballo negro',
  chessPiece_black_bishop: 'alfil negro',
  chessPiece_black_rook: 'torre negra',
  chessPiece_black_queen: 'dama negra',
  chessPiece_black_king: 'rey negro',
  chessSquareEmpty: '{square}, vacía',
  chessSquarePiece: '{square}, {piece}',
  chessSquareSelected: '{square}, {piece}, seleccionado',
  chessSquareInCheck: '{square}, {piece}, en jaque',
  chessSquareMoveHere: '{square}: mover aquí',
  chessSquareCaptureHere: '{square}, {piece}: capturar aquí',
  chessSquareCaptureEnPassant: '{square}: mover aquí y capturar el peón de al lado',
  chessYourTurn: 'Tu turno',
  chessYourTurnCheck: 'Jaque — tu rey está atacado',
  chessCpuTurn: 'Turno de la CPU',
  chessCpuTurnCheck: 'Jaque — turno de la CPU',
  chessPromoteTitle: 'Coronar el peón en',
  chessWinTitle: 'Ganaste',
  chessLoseTitle: 'Gana la CPU',
  chessDrawTitle: 'Tablas',
  chessReason_checkmate: 'Jaque mate: el rey está en jaque y no tiene ningún movimiento legal.',
  chessReason_stalemate: 'Ahogado: no hay movimiento legal y el rey no está en jaque.',
  chessReason_insufficient: 'Material insuficiente: ningún bando puede dar jaque mate.',
  chessReason_repetition: 'Triple repetición: la misma posición por tercera vez.',
  chessReason_fifty:
    'Regla de los 50 movimientos: 50 movimientos de cada bando sin captura ni movimiento de peón.',
  chessResultSide: 'Tu color',
  chessResultMoves: 'Movimientos',
  chessSideWhite: 'Blancas',
  chessSideBlack: 'Negras',
  chessWins: 'Victorias',
  chessDraws: 'Tablas',
  chessLosses: 'Derrotas',
  chessStep1Title: 'Cada pieza mueve a su manera',
  chessStep1Body: 'Toca una de tus piezas y unos puntos muestran cada casilla a la que puede ir.',
  chessStep2Title: 'Captura, pero protege a tu rey',
  chessStep2Body:
    'Mueve a la casilla de una pieza rival para capturarla (el peón captura en diagonal), pero ningún movimiento puede dejar a tu rey atacado.',
  chessStep3Title: 'El jaque mate gana',
  chessStep3Body:
    'Da jaque al rey sin escapatoria para ganar; sin movimiento legal y sin jaque, son tablas.',
};
