/**
 * Tangram — the Hindi catalog. Provenance (docs/TANGRAM_RULES.md §11):
 * `machine` — written by an AI from the English source on 2026-10-21; nobody
 * has read it, native speaker or author. The title (`tangramName`) stays
 * "Tangram".
 *
 * Terms: छाया-आकृति (silhouette — "the figure's shadow"), आकृति (figure),
 * टुकड़ा (piece), ट्रे (tray), बोर्ड (board, as in the shell). Every piece name
 * is masculine (त्रिभुज, समांतर चतुर्भुज, वर्ग), so the participles agree.
 * Tiers and the daily follow the puzzle shelf (आसान / मध्यम / कठिन, डेली).
 */
import type { TangramMessages } from './en';

export const hi: TangramMessages = {
  tangramName: 'Tangram',

  tangramTier_easy: 'आसान',
  tangramTier_medium: 'मध्यम',
  tangramTier_hard: 'कठिन',
  tangramFigureName: '{tier} {number}',
  tangramDailyName: 'डेली, {date}',
  tangramSilhouetteLabel: 'छाया-आकृति: {figure}',

  tangramConfirmReplaceTitle: 'चालू आकृति बदलें?',
  tangramConfirmReplaceBody: 'आकृति {current} को {next} से बदल दिया जाएगा।',

  tangramPiece_L1: 'बड़ा त्रिभुज 1',
  tangramPiece_L2: 'बड़ा त्रिभुज 2',
  tangramPiece_M: 'मध्यम त्रिभुज',
  tangramPiece_P: 'समांतर चतुर्भुज',
  tangramPiece_SQ: 'वर्ग',
  tangramPiece_S1: 'छोटा त्रिभुज 1',
  tangramPiece_S2: 'छोटा त्रिभुज 2',
  tangramPieceInTray: '{piece}, {angle}° घुमाया हुआ, ट्रे में',
  tangramPieceInTrayFlipped: '{piece}, {angle}° घुमाया हुआ, पलटा हुआ, ट्रे में',
  tangramPieceOnBoard: '{piece}, {angle}° घुमाया हुआ, बोर्ड पर',
  tangramPieceOnBoardFlipped: '{piece}, {angle}° घुमाया हुआ, पलटा हुआ, बोर्ड पर',
  tangramPieceFixed: '{piece}, {angle}° घुमाया हुआ, अपनी जगह पर स्थिर',
  tangramPieceFixedFlipped: '{piece}, {angle}° घुमाया हुआ, पलटा हुआ, अपनी जगह पर स्थिर',

  tangramRotate: 'घुमाएँ',
  tangramFlip: 'पलटें',

  tangramLifted:
    '{piece} उठाया गया। तीर कुंजियों से हिलाएँ, Enter से रखें, Esc से ट्रे में वापस भेजें।',
  tangramFitsOutlineVertex: 'रखा जा सकता है, छाया-आकृति के कोने पर',
  tangramFitsOutlineEdge: 'रखा जा सकता है, छाया-आकृति के किनारे पर',
  tangramFitsPieceVertex: 'रखा जा सकता है, दूसरे टुकड़े के कोने पर',
  tangramFitsPieceEdge: 'रखा जा सकता है, दूसरे टुकड़े के किनारे पर',
  tangramNoFit: 'यहाँ नहीं रखा जा सकता',

  tangramStep1Title: 'खींचें और घुमाएँ',
  tangramStep1Body:
    'टुकड़े को छाया-आकृति पर खींचकर रखें, घुमाने के लिए उस पर टैप करें (पलटें बटन समांतर चतुर्भुज को उलटता है)।',
  tangramStep2Title: 'अंदर, ऊपर कभी नहीं',
  tangramStep2Body:
    'टुकड़ा सिर्फ़ छाया-आकृति के अंदर रखा जा सकता है, किसी दूसरे टुकड़े के ऊपर कभी नहीं।',
  tangramStep3Title: 'पूरा भर दें',
  tangramStep3Body: 'जब सातों टुकड़े छाया-आकृति को ठीक-ठीक भर दें, तो आकृति पूरी हो जाती है।',

  tangramResultTitle: 'आकृति पूरी हुई',
  tangramNextFigure: 'अगली आकृति',
  tangramTierLabel: 'स्तर',
  tangramFigureLabel: 'आकृति',

  tangramStatStarted: 'शुरू की गई आकृतियाँ',
  tangramStatCompleted: 'पूरी की गई आकृतियाँ',
  tangramStatDifferent: 'पूरी की गई अलग-अलग आकृतियाँ',
  tangramStatDays: 'पूरे किए गए दिन',
  tangramStatsAll: 'सभी खेल',
};
