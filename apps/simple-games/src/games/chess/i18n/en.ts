/**
 * Chess's own strings (issue #38): bundled into the game's chunk, not the
 * entry, and registered on chunk load by ./index.ts. The shell's catalog stays
 * the source of truth for shared keys (Undo, New Game, Home, Statistics,
 * Difficulty …), this file for this game's.
 *
 * `en` is the original (docs/CHESS_RULES.md §10). The glossary of §10.1 came
 * first and every locale uses its words: check · checkmate · stalemate ·
 * draw · insufficient material · threefold repetition · fifty-move rule, and
 * the six pieces with White / Black. Who won and why are separate keys — the
 * title says the result, the reason line only why — so a stalemate rendered
 * as a mate in some language still sits under a "Draw" title.
 *
 * The pieces are read out through twelve keys, colour and piece together,
 * never "{colour} {piece}" glued at runtime: in French, Spanish, Portuguese
 * and German the colour word agrees with the piece's gender.
 *
 * `chessName` is the literal title in every locale: a game's title is a
 * proper noun and is never translated (docs/I18N_POLICY.md).
 */
export const en = {
  chessName: 'Chess',
  chessChooseOpponent: 'Choose your opponent',
  chessDifficulty_easy: 'Easy',
  chessDifficulty_normal: 'Normal',
  chessDifficulty_hard: 'Hard',
  chessRecordNote: 'Won {wins} · Drawn {draws} · Lost {losses}',
  chessChooseSideLabel: 'Your side in the next game',
  chessPlayWhite: 'White (moves first)',
  chessPlayBlack: 'Black (moves second)',
  chessConfirmSwitchTitle: 'Replace the game in progress?',
  chessConfirmSwitchBody: 'Your {current} game will be replaced by a new {next} game.',
  chessYouPlayWhite: 'You play White',
  chessYouPlayBlack: 'You play Black',
  chessBoardLabel: 'Chess board',
  chessPiece_white_pawn: 'white pawn',
  chessPiece_white_knight: 'white knight',
  chessPiece_white_bishop: 'white bishop',
  chessPiece_white_rook: 'white rook',
  chessPiece_white_queen: 'white queen',
  chessPiece_white_king: 'white king',
  chessPiece_black_pawn: 'black pawn',
  chessPiece_black_knight: 'black knight',
  chessPiece_black_bishop: 'black bishop',
  chessPiece_black_rook: 'black rook',
  chessPiece_black_queen: 'black queen',
  chessPiece_black_king: 'black king',
  chessSquareEmpty: '{square}, empty',
  chessSquarePiece: '{square}, {piece}',
  chessSquareSelected: '{square}, {piece}, selected',
  chessSquareInCheck: '{square}, {piece}, in check',
  chessSquareMoveHere: '{square}: move here',
  chessSquareCaptureHere: '{square}, {piece}: capture here',
  chessSquareCaptureEnPassant: '{square}: capture the pawn beside it here',
  chessYourTurn: 'Your turn',
  chessYourTurnCheck: 'Check — your king is attacked',
  chessCpuTurn: 'CPU’s turn',
  chessCpuTurnCheck: 'Check — CPU’s turn',
  chessPromoteTitle: 'Promote the pawn to',
  chessWinTitle: 'You win',
  chessLoseTitle: 'The CPU wins',
  chessDrawTitle: 'Draw',
  chessReason_checkmate: 'Checkmate: the king is in check and has no legal move.',
  chessReason_stalemate: 'Stalemate: no legal move, and the king is not in check.',
  chessReason_insufficient: 'Insufficient material: neither side can checkmate.',
  chessReason_repetition: 'Threefold repetition: the same position for the third time.',
  chessReason_fifty: 'Fifty-move rule: fifty moves each without a capture or a pawn move.',
  chessResultSide: 'Your side',
  chessResultMoves: 'Moves',
  chessSideWhite: 'White',
  chessSideBlack: 'Black',
  chessWins: 'Wins',
  chessDraws: 'Draws',
  chessLosses: 'Losses',
  chessStep1Title: 'Each piece moves its own way',
  chessStep1Body: 'Tap one of your pieces and dots show every square it can move to.',
  chessStep2Title: 'Capture, but keep your king safe',
  chessStep2Body:
    'Move onto an opponent’s piece to capture it (a pawn captures diagonally), but no move may leave your king attacked.',
  chessStep3Title: 'Checkmate wins',
  chessStep3Body: 'Check the king with no escape to win; no legal move without check is a draw.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type ChessMessages = Record<keyof typeof en, string>;
