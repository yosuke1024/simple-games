/**
 * Chess — the Hindi catalog. Provenance (docs/CHESS_RULES.md §10): `machine` —
 * written by an AI from the English source on 2026-10-22; no native speaker
 * has read it, and neither has the author. The title (`chessName`) is a
 * proper noun and stays as-is.
 *
 * Glossary (§10.1): शह · शहमात · स्टेलमेट (the transliteration; never शहमात) · ड्रॉ · अपर्याप्त मोहरे · तीन बार दोहराव · 50 चालों का नियम; प्यादा · घोड़ा · ऊँट · हाथी · वज़ीर · राजा; सफ़ेद · काला. Of the two candidates स्टेलमेट / गतिरोध, §10 chose स्टेलमेट alone. Promotion is the verb बदलना (§10.1).
 */
import type { ChessMessages } from './en';

export const hi: ChessMessages = {
  chessName: 'Chess',
  chessChooseOpponent: 'अपना प्रतिद्वंद्वी चुनें',
  chessDifficulty_easy: 'आसान',
  chessDifficulty_normal: 'सामान्य',
  chessDifficulty_hard: 'कठिन',
  chessRecordNote: 'जीत {wins} · ड्रॉ {draws} · हार {losses}',
  chessChooseSideLabel: 'अगली बाज़ी में आपका रंग',
  chessPlayWhite: 'सफ़ेद (पहले चलता है)',
  chessPlayBlack: 'काला (बाद में चलता है)',
  chessConfirmSwitchTitle: 'चल रही बाज़ी बदलें?',
  chessConfirmSwitchBody: 'आपकी {current} बाज़ी की जगह नई {next} बाज़ी शुरू होगी।',
  chessYouPlayWhite: 'आप सफ़ेद से खेल रहे हैं',
  chessYouPlayBlack: 'आप काले से खेल रहे हैं',
  chessBoardLabel: 'शतरंज की बिसात',
  chessPiece_white_pawn: 'सफ़ेद प्यादा',
  chessPiece_white_knight: 'सफ़ेद घोड़ा',
  chessPiece_white_bishop: 'सफ़ेद ऊँट',
  chessPiece_white_rook: 'सफ़ेद हाथी',
  chessPiece_white_queen: 'सफ़ेद वज़ीर',
  chessPiece_white_king: 'सफ़ेद राजा',
  chessPiece_black_pawn: 'काला प्यादा',
  chessPiece_black_knight: 'काला घोड़ा',
  chessPiece_black_bishop: 'काला ऊँट',
  chessPiece_black_rook: 'काला हाथी',
  chessPiece_black_queen: 'काला वज़ीर',
  chessPiece_black_king: 'काला राजा',
  chessSquareEmpty: '{square}, खाली',
  chessSquarePiece: '{square}, {piece}',
  chessSquareSelected: '{square}, {piece}, चुना गया',
  chessSquareInCheck: '{square}, {piece}, शह में',
  chessSquareMoveHere: '{square}: यहाँ चलें',
  chessSquareCaptureHere: '{square}, {piece}: यहाँ मारें',
  chessSquareCaptureEnPassant: '{square}: यहाँ चलें और बगल वाले प्यादे को मारें',
  chessYourTurn: 'आपकी बारी',
  chessYourTurnCheck: 'शह — आपके राजा पर हमला है',
  chessCpuTurn: 'CPU की बारी',
  chessCpuTurnCheck: 'शह — CPU की बारी',
  chessPromoteTitle: 'प्यादे को इसमें बदलें',
  chessWinTitle: 'आप जीते',
  chessLoseTitle: 'CPU जीता',
  chessDrawTitle: 'ड्रॉ',
  chessReason_checkmate: 'शहमात: राजा शह में है और उसकी कोई वैध चाल नहीं है।',
  chessReason_stalemate: 'स्टेलमेट: कोई वैध चाल नहीं है, और राजा शह में नहीं है।',
  chessReason_insufficient: 'अपर्याप्त मोहरे: कोई भी पक्ष शहमात नहीं दे सकता।',
  chessReason_repetition: 'तीन बार दोहराव: वही स्थिति तीसरी बार आई।',
  chessReason_fifty:
    '50 चालों का नियम: दोनों ओर से 50-50 चालें बिना किसी मोहरे को मारे और बिना प्यादे की चाल के।',
  chessResultSide: 'आपका रंग',
  chessResultMoves: 'चालें',
  chessSideWhite: 'सफ़ेद',
  chessSideBlack: 'काला',
  chessWins: 'जीत',
  chessDraws: 'ड्रॉ',
  chessLosses: 'हार',
  chessStep1Title: 'हर मोहरा अपने ढंग से चलता है',
  chessStep1Body: 'अपने किसी मोहरे पर टैप करें, और बिंदु हर वह खाना दिखाएँगे जहाँ वह जा सकता है।',
  chessStep2Title: 'मारें, पर राजा को बचाएँ',
  chessStep2Body:
    'विरोधी मोहरे के खाने पर जाकर उसे मारें (प्यादा तिरछा मारता है), पर कोई भी चाल आपके राजा को हमले में नहीं छोड़ सकती।',
  chessStep3Title: 'शहमात से जीत',
  chessStep3Body:
    'राजा को ऐसा शह दें जिससे बचने का रास्ता न हो, तो जीत; शह के बिना कोई वैध चाल न हो, तो ड्रॉ।',
};
