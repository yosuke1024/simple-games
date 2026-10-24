/**
 * Chess — the Vietnamese catalog. Provenance (docs/CHESS_RULES.md §10): `machine` —
 * written by an AI from the English source on 2026-10-22; no native speaker
 * has read it, and neither has the author. The title (`chessName`) is a
 * proper noun and stays as-is.
 *
 * Glossary (§10.1): chiếu · chiếu hết · hết nước đi (the stalemate; never chiếu hết) · hòa · không đủ quân · lặp lại ba lần · luật 50 nước; tốt · mã · tượng · xe · hậu · vua; Trắng · Đen. Of the two candidates "hết nước đi" / "pat", §10 chose "hết nước đi" alone.
 */
import type { ChessMessages } from './en';

export const vi: ChessMessages = {
  chessName: 'Chess',
  chessChooseOpponent: 'Chọn đối thủ',
  chessDifficulty_easy: 'Dễ',
  chessDifficulty_normal: 'Thường',
  chessDifficulty_hard: 'Khó',
  chessRecordNote: 'Thắng {wins} · Hòa {draws} · Thua {losses}',
  chessChooseSideLabel: 'Màu quân của bạn ở ván sau',
  chessPlayWhite: 'Trắng (đi trước)',
  chessPlayBlack: 'Đen (đi sau)',
  chessConfirmSwitchTitle: 'Thay ván đang chơi?',
  chessConfirmSwitchBody: 'Ván {current} của bạn sẽ được thay bằng một ván {next} mới.',
  chessYouPlayWhite: 'Bạn cầm quân Trắng',
  chessYouPlayBlack: 'Bạn cầm quân Đen',
  chessBoardLabel: 'Bàn cờ vua',
  chessPiece_white_pawn: 'tốt trắng',
  chessPiece_white_knight: 'mã trắng',
  chessPiece_white_bishop: 'tượng trắng',
  chessPiece_white_rook: 'xe trắng',
  chessPiece_white_queen: 'hậu trắng',
  chessPiece_white_king: 'vua trắng',
  chessPiece_black_pawn: 'tốt đen',
  chessPiece_black_knight: 'mã đen',
  chessPiece_black_bishop: 'tượng đen',
  chessPiece_black_rook: 'xe đen',
  chessPiece_black_queen: 'hậu đen',
  chessPiece_black_king: 'vua đen',
  chessSquareEmpty: '{square}, trống',
  chessSquarePiece: '{square}, {piece}',
  chessSquareSelected: '{square}, {piece}, đang chọn',
  chessSquareInCheck: '{square}, {piece}, đang bị chiếu',
  chessSquareMoveHere: '{square}: đi đến đây',
  chessSquareCaptureHere: '{square}, {piece}: ăn ở đây',
  chessSquareCaptureEnPassant: '{square}: đi đến đây và ăn con tốt bên cạnh',
  chessYourTurn: 'Lượt của bạn',
  chessYourTurnCheck: 'Chiếu — vua của bạn đang bị tấn công',
  chessCpuTurn: 'Lượt của CPU',
  chessCpuTurnCheck: 'Chiếu — lượt của CPU',
  chessPromoteTitle: 'Phong cấp tốt thành',
  chessWinTitle: 'Bạn thắng',
  chessLoseTitle: 'CPU thắng',
  chessDrawTitle: 'Hòa',
  chessReason_checkmate: 'Chiếu hết: vua đang bị chiếu và không còn nước đi hợp lệ.',
  chessReason_stalemate: 'Hết nước đi: không còn nước đi hợp lệ, và vua không bị chiếu.',
  chessReason_insufficient: 'Không đủ quân: không bên nào có thể chiếu hết.',
  chessReason_repetition: 'Lặp lại ba lần: cùng một thế cờ xuất hiện lần thứ ba.',
  chessReason_fifty: 'Luật 50 nước: mỗi bên đi 50 nước mà không ăn quân và không đi tốt.',
  chessResultSide: 'Màu quân của bạn',
  chessResultMoves: 'Số nước',
  chessSideWhite: 'Trắng',
  chessSideBlack: 'Đen',
  chessWins: 'Thắng',
  chessDraws: 'Hòa',
  chessLosses: 'Thua',
  chessStep1Title: 'Mỗi quân đi một kiểu',
  chessStep1Body: 'Chạm vào một quân của bạn, các chấm sẽ hiện mọi ô quân đó đi được.',
  chessStep2Title: 'Ăn quân, nhưng giữ an toàn cho vua',
  chessStep2Body:
    'Đi vào ô có quân đối phương để ăn nó (tốt ăn chéo), nhưng không nước nào được để vua của bạn bị tấn công.',
  chessStep3Title: 'Chiếu hết là thắng',
  chessStep3Body:
    'Chiếu vua mà không còn đường thoát thì thắng; không có nước đi hợp lệ mà không bị chiếu thì hòa.',
};
