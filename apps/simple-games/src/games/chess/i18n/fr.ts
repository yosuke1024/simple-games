/**
 * Chess — the French catalog. Provenance (docs/CHESS_RULES.md §10): `machine` —
 * written by an AI from the English source on 2026-10-22; no native speaker
 * has read it, and neither has the author. The title (`chessName`) is a
 * proper noun and stays as-is.
 *
 * Glossary (§10.1): échec · échec et mat · pat (never "mat") · nulle · matériel insuffisant · triple répétition · règle des 50 coups; pion · cavalier · fou · tour · dame · roi; Blancs · Noirs. The colour agrees with each piece in the twelve piece keys (pion blanc, dame blanche).
 */
import type { ChessMessages } from './en';

export const fr: ChessMessages = {
  chessName: 'Chess',
  chessChooseOpponent: 'Choisissez votre adversaire',
  chessDifficulty_easy: 'Facile',
  chessDifficulty_normal: 'Normal',
  chessDifficulty_hard: 'Difficile',
  chessRecordNote: 'Victoires {wins} · Nulles {draws} · Défaites {losses}',
  chessChooseSideLabel: 'Votre camp pour la prochaine partie',
  chessPlayWhite: 'Blancs (jouent en premier)',
  chessPlayBlack: 'Noirs (jouent en second)',
  chessConfirmSwitchTitle: 'Remplacer la partie en cours ?',
  chessConfirmSwitchBody:
    'Votre partie ({current}) sera remplacée par une nouvelle partie ({next}).',
  chessYouPlayWhite: 'Vous jouez les Blancs',
  chessYouPlayBlack: 'Vous jouez les Noirs',
  chessBoardLabel: 'Échiquier',
  chessPiece_white_pawn: 'pion blanc',
  chessPiece_white_knight: 'cavalier blanc',
  chessPiece_white_bishop: 'fou blanc',
  chessPiece_white_rook: 'tour blanche',
  chessPiece_white_queen: 'dame blanche',
  chessPiece_white_king: 'roi blanc',
  chessPiece_black_pawn: 'pion noir',
  chessPiece_black_knight: 'cavalier noir',
  chessPiece_black_bishop: 'fou noir',
  chessPiece_black_rook: 'tour noire',
  chessPiece_black_queen: 'dame noire',
  chessPiece_black_king: 'roi noir',
  chessSquareEmpty: '{square}, vide',
  chessSquarePiece: '{square}, {piece}',
  chessSquareSelected: '{square}, {piece}, sélectionné',
  chessSquareInCheck: '{square}, {piece}, en échec',
  chessSquareMoveHere: '{square} : jouer ici',
  chessSquareCaptureHere: '{square}, {piece} : prendre ici',
  chessSquareCaptureEnPassant: '{square} : jouer ici et prendre le pion d’à côté',
  chessYourTurn: 'À vous de jouer',
  chessYourTurnCheck: 'Échec — votre roi est attaqué',
  chessCpuTurn: 'Au tour du CPU',
  chessCpuTurnCheck: 'Échec — au tour du CPU',
  chessPromoteTitle: 'Promouvoir le pion en',
  chessWinTitle: 'Vous avez gagné',
  chessLoseTitle: 'Le CPU gagne',
  chessDrawTitle: 'Partie nulle',
  chessReason_checkmate: 'Échec et mat : le roi est en échec et n’a aucun coup légal.',
  chessReason_stalemate: 'Pat : aucun coup légal, et le roi n’est pas en échec.',
  chessReason_insufficient: 'Matériel insuffisant : aucun camp ne peut faire échec et mat.',
  chessReason_repetition: 'Triple répétition : la même position pour la troisième fois.',
  chessReason_fifty: 'Règle des 50 coups : 50 coups de chaque camp sans prise ni coup de pion.',
  chessResultSide: 'Votre camp',
  chessResultMoves: 'Coups',
  chessSideWhite: 'Blancs',
  chessSideBlack: 'Noirs',
  chessWins: 'Victoires',
  chessDraws: 'Nulles',
  chessLosses: 'Défaites',
  chessStep1Title: 'Chaque pièce a sa marche',
  chessStep1Body: 'Touchez une de vos pièces : des points montrent chaque case où elle peut aller.',
  chessStep2Title: 'Prenez, mais protégez votre roi',
  chessStep2Body:
    'Allez sur une pièce adverse pour la prendre (le pion prend en diagonale), mais aucun coup ne peut laisser votre roi attaqué.',
  chessStep3Title: 'L’échec et mat gagne',
  chessStep3Body:
    'Mettez le roi en échec sans issue pour gagner ; aucun coup légal sans échec, c’est la nulle.',
};
