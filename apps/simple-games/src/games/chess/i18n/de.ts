/**
 * Chess — the German catalog. Provenance (docs/CHESS_RULES.md §10): `machine` —
 * written by an AI from the English source on 2026-10-22; no native speaker
 * has read it, and neither has the author. The title (`chessName`) is a
 * proper noun and stays as-is.
 *
 * Glossary (§10.1): Schach · Schachmatt · Patt (never "matt") · Remis · ungenügendes Material · dreifache Stellungswiederholung · 50-Züge-Regel; Bauer · Springer · Läufer · Turm · Dame · König; Weiß · Schwarz. The colour agrees with each piece's gender in the twelve piece keys (weißer Bauer, weiße Dame).
 */
import type { ChessMessages } from './en';

export const de: ChessMessages = {
  chessName: 'Chess',
  chessChooseOpponent: 'Wähle deinen Gegner',
  chessDifficulty_easy: 'Leicht',
  chessDifficulty_normal: 'Normal',
  chessDifficulty_hard: 'Schwer',
  chessRecordNote: 'Siege {wins} · Remis {draws} · Niederlagen {losses}',
  chessChooseSideLabel: 'Deine Farbe in der nächsten Partie',
  chessPlayWhite: 'Weiß (zieht zuerst)',
  chessPlayBlack: 'Schwarz (zieht als Zweiter)',
  chessConfirmSwitchTitle: 'Laufende Partie ersetzen?',
  chessConfirmSwitchBody: 'Deine Partie ({current}) wird durch eine neue Partie ({next}) ersetzt.',
  chessYouPlayWhite: 'Du spielst Weiß',
  chessYouPlayBlack: 'Du spielst Schwarz',
  chessBoardLabel: 'Schachbrett',
  chessPiece_white_pawn: 'weißer Bauer',
  chessPiece_white_knight: 'weißer Springer',
  chessPiece_white_bishop: 'weißer Läufer',
  chessPiece_white_rook: 'weißer Turm',
  chessPiece_white_queen: 'weiße Dame',
  chessPiece_white_king: 'weißer König',
  chessPiece_black_pawn: 'schwarzer Bauer',
  chessPiece_black_knight: 'schwarzer Springer',
  chessPiece_black_bishop: 'schwarzer Läufer',
  chessPiece_black_rook: 'schwarzer Turm',
  chessPiece_black_queen: 'schwarze Dame',
  chessPiece_black_king: 'schwarzer König',
  chessSquareEmpty: '{square}, leer',
  chessSquarePiece: '{square}, {piece}',
  chessSquareSelected: '{square}, {piece}, ausgewählt',
  chessSquareInCheck: '{square}, {piece}, steht im Schach',
  chessSquareMoveHere: '{square}: hierhin ziehen',
  chessSquareCaptureHere: '{square}, {piece}: hier schlagen',
  chessSquareCaptureEnPassant: '{square}: hierhin ziehen und den Bauern daneben schlagen',
  chessYourTurn: 'Du bist am Zug',
  chessYourTurnCheck: 'Schach — dein König wird angegriffen',
  chessCpuTurn: 'Die CPU ist am Zug',
  chessCpuTurnCheck: 'Schach — die CPU ist am Zug',
  chessPromoteTitle: 'Bauer umwandeln in',
  chessWinTitle: 'Du gewinnst',
  chessLoseTitle: 'Die CPU gewinnt',
  chessDrawTitle: 'Remis',
  chessReason_checkmate: 'Schachmatt: Der König steht im Schach und hat keinen legalen Zug.',
  chessReason_stalemate: 'Patt: Kein legaler Zug, und der König steht nicht im Schach.',
  chessReason_insufficient: 'Ungenügendes Material: Keine Seite kann Schachmatt setzen.',
  chessReason_repetition: 'Dreifache Stellungswiederholung: Dieselbe Stellung zum dritten Mal.',
  chessReason_fifty: '50-Züge-Regel: 50 Züge je Seite ohne Schlagen und ohne Bauernzug.',
  chessResultSide: 'Deine Farbe',
  chessResultMoves: 'Züge',
  chessSideWhite: 'Weiß',
  chessSideBlack: 'Schwarz',
  chessWins: 'Siege',
  chessDraws: 'Remis',
  chessLosses: 'Niederlagen',
  chessStep1Title: 'Jede Figur zieht auf ihre Art',
  chessStep1Body:
    'Tippe eine deiner Figuren an, und Punkte zeigen jedes Feld, auf das sie ziehen kann.',
  chessStep2Title: 'Schlagen, aber den König schützen',
  chessStep2Body:
    'Ziehe auf eine gegnerische Figur, um sie zu schlagen (ein Bauer schlägt schräg), aber kein Zug darf deinen König angegriffen lassen.',
  chessStep3Title: 'Schachmatt gewinnt',
  chessStep3Body:
    'Setze den König ohne Ausweg ins Schach, um zu gewinnen; kein legaler Zug ohne Schach ist Remis.',
};
