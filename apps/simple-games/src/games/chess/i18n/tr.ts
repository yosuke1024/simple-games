/**
 * Chess — the Turkish catalog. Provenance (docs/CHESS_RULES.md §10): `machine` —
 * written by an AI from the English source on 2026-10-22; no native speaker
 * has read it, and neither has the author. The title (`chessName`) is a
 * proper noun and stays as-is.
 *
 * Glossary (§10.1): şah · şah mat · pat (never "mat") · beraberlik · yetersiz materyal · üç kez tekrar · 50 hamle kuralı; piyon · at · fil · kale · vezir · şah; Beyaz · Siyah. "Şah" is both the king and check, so check is written as the verb ("şah çekildi" / "şahta") and the king as the piece.
 */
import type { ChessMessages } from './en';

export const tr: ChessMessages = {
  chessName: 'Chess',
  chessChooseOpponent: 'Rakibini seç',
  chessDifficulty_easy: 'Kolay',
  chessDifficulty_normal: 'Normal',
  chessDifficulty_hard: 'Zor',
  chessRecordNote: 'Galibiyet {wins} · Beraberlik {draws} · Yenilgi {losses}',
  chessChooseSideLabel: 'Sonraki oyunda rengin',
  chessPlayWhite: 'Beyaz (önce oynar)',
  chessPlayBlack: 'Siyah (sonra oynar)',
  chessConfirmSwitchTitle: 'Süren oyun değiştirilsin mi?',
  chessConfirmSwitchBody: '{current} oyunun, yeni bir {next} oyunla değiştirilecek.',
  chessYouPlayWhite: 'Beyazla oynuyorsun',
  chessYouPlayBlack: 'Siyahla oynuyorsun',
  chessBoardLabel: 'Satranç tahtası',
  chessPiece_white_pawn: 'beyaz piyon',
  chessPiece_white_knight: 'beyaz at',
  chessPiece_white_bishop: 'beyaz fil',
  chessPiece_white_rook: 'beyaz kale',
  chessPiece_white_queen: 'beyaz vezir',
  chessPiece_white_king: 'beyaz şah',
  chessPiece_black_pawn: 'siyah piyon',
  chessPiece_black_knight: 'siyah at',
  chessPiece_black_bishop: 'siyah fil',
  chessPiece_black_rook: 'siyah kale',
  chessPiece_black_queen: 'siyah vezir',
  chessPiece_black_king: 'siyah şah',
  chessSquareEmpty: '{square}, boş',
  chessSquarePiece: '{square}, {piece}',
  chessSquareSelected: '{square}, {piece}, seçili',
  chessSquareInCheck: '{square}, {piece}, şah çekildi',
  chessSquareMoveHere: '{square}: buraya oyna',
  chessSquareCaptureHere: '{square}, {piece}: burada al',
  chessSquareCaptureEnPassant: '{square}: buraya oyna ve yandaki piyonu al',
  chessYourTurn: 'Sıra sende',
  chessYourTurnCheck: 'Şah çekildi — şahın saldırı altında',
  chessCpuTurn: 'Sıra CPU’da',
  chessCpuTurnCheck: 'Şah çekildi — sıra CPU’da',
  chessPromoteTitle: 'Piyonun terfi edeceği taş',
  chessWinTitle: 'Kazandın',
  chessLoseTitle: 'CPU kazandı',
  chessDrawTitle: 'Beraberlik',
  chessReason_checkmate: 'Şah mat: şaha şah çekildi ve geçerli bir hamlesi yok.',
  chessReason_stalemate: 'Pat: geçerli hamle yok ve şaha şah çekilmiş değil.',
  chessReason_insufficient: 'Yetersiz materyal: iki taraf da mat edemez.',
  chessReason_repetition: 'Üç kez tekrar: aynı konum üçüncü kez oluştu.',
  chessReason_fifty:
    '50 hamle kuralı: iki taraf da taş almadan ve piyon oynamadan 50’şer hamle yaptı.',
  chessResultSide: 'Rengin',
  chessResultMoves: 'Hamle',
  chessSideWhite: 'Beyaz',
  chessSideBlack: 'Siyah',
  chessWins: 'Galibiyet',
  chessDraws: 'Beraberlik',
  chessLosses: 'Yenilgi',
  chessStep1Title: 'Her taş kendi yolunda gider',
  chessStep1Body: 'Taşlarından birine dokun; noktalar gidebileceği her kareyi gösterir.',
  chessStep2Title: 'Al, ama şahını koru',
  chessStep2Body:
    'Rakip bir taşın karesine giderek onu al (piyon çapraz alır), ama hiçbir hamle şahını saldırı altında bırakamaz.',
  chessStep3Title: 'Şah mat kazandırır',
  chessStep3Body:
    'Kaçacak yeri olmayan şaha şah çek ve kazan; şah çekilmeden geçerli hamle kalmazsa beraberliktir.',
};
