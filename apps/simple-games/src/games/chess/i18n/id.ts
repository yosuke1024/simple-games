/**
 * Chess — the Indonesian catalog. Provenance (docs/CHESS_RULES.md §10): `machine` —
 * written by an AI from the English source on 2026-10-22; no native speaker
 * has read it, and neither has the author. The title (`chessName`) is a
 * proper noun and stays as-is.
 *
 * Glossary (§10.1): skak · skakmat · pat (never "mat") · remis · materi tidak cukup · pengulangan tiga kali · aturan 50 langkah; pion · kuda · gajah · benteng · menteri · raja; putih · hitam.
 */
import type { ChessMessages } from './en';

export const id: ChessMessages = {
  chessName: 'Chess',
  chessChooseOpponent: 'Pilih lawanmu',
  chessDifficulty_easy: 'Mudah',
  chessDifficulty_normal: 'Normal',
  chessDifficulty_hard: 'Sulit',
  chessRecordNote: 'Menang {wins} · Remis {draws} · Kalah {losses}',
  chessChooseSideLabel: 'Warnamu di permainan berikutnya',
  chessPlayWhite: 'Putih (jalan duluan)',
  chessPlayBlack: 'Hitam (jalan kedua)',
  chessConfirmSwitchTitle: 'Ganti permainan yang sedang berjalan?',
  chessConfirmSwitchBody: 'Permainan {current} akan diganti dengan permainan {next} yang baru.',
  chessYouPlayWhite: 'Kamu bermain Putih',
  chessYouPlayBlack: 'Kamu bermain Hitam',
  chessBoardLabel: 'Papan catur',
  chessPiece_white_pawn: 'pion putih',
  chessPiece_white_knight: 'kuda putih',
  chessPiece_white_bishop: 'gajah putih',
  chessPiece_white_rook: 'benteng putih',
  chessPiece_white_queen: 'menteri putih',
  chessPiece_white_king: 'raja putih',
  chessPiece_black_pawn: 'pion hitam',
  chessPiece_black_knight: 'kuda hitam',
  chessPiece_black_bishop: 'gajah hitam',
  chessPiece_black_rook: 'benteng hitam',
  chessPiece_black_queen: 'menteri hitam',
  chessPiece_black_king: 'raja hitam',
  chessSquareEmpty: '{square}, kosong',
  chessSquarePiece: '{square}, {piece}',
  chessSquareSelected: '{square}, {piece}, dipilih',
  chessSquareInCheck: '{square}, {piece}, terkena skak',
  chessSquareMoveHere: '{square}: jalan ke sini',
  chessSquareCaptureHere: '{square}, {piece}: makan di sini',
  chessSquareCaptureEnPassant: '{square}: jalan ke sini dan makan pion di sebelahnya',
  chessYourTurn: 'Giliranmu',
  chessYourTurnCheck: 'Skak — rajamu diserang',
  chessCpuTurn: 'Giliran CPU',
  chessCpuTurnCheck: 'Skak — giliran CPU',
  chessPromoteTitle: 'Promosikan pion menjadi',
  chessWinTitle: 'Kamu menang',
  chessLoseTitle: 'CPU menang',
  chessDrawTitle: 'Remis',
  chessReason_checkmate: 'Skakmat: raja terkena skak dan tidak punya langkah sah.',
  chessReason_stalemate: 'Pat: tidak ada langkah sah, dan raja tidak terkena skak.',
  chessReason_insufficient: 'Materi tidak cukup: tidak ada pihak yang bisa memberi skakmat.',
  chessReason_repetition: 'Pengulangan tiga kali: posisi yang sama untuk ketiga kalinya.',
  chessReason_fifty:
    'Aturan 50 langkah: masing-masing 50 langkah tanpa memakan buah dan tanpa langkah pion.',
  chessResultSide: 'Warnamu',
  chessResultMoves: 'Langkah',
  chessSideWhite: 'Putih',
  chessSideBlack: 'Hitam',
  chessWins: 'Menang',
  chessDraws: 'Remis',
  chessLosses: 'Kalah',
  chessStep1Title: 'Setiap buah punya caranya sendiri',
  chessStep1Body: 'Ketuk salah satu buahmu, dan titik menunjukkan setiap petak yang bisa ia tuju.',
  chessStep2Title: 'Makan, tapi lindungi rajamu',
  chessStep2Body:
    'Jalan ke petak buah lawan untuk memakannya (pion memakan secara diagonal), tapi tidak ada langkah yang boleh membiarkan rajamu diserang.',
  chessStep3Title: 'Skakmat menang',
  chessStep3Body:
    'Beri skak pada raja tanpa jalan keluar untuk menang; tanpa langkah sah dan tanpa skak berarti remis.',
};
