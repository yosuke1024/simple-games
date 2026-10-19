/**
 * Hindi catalog for Unblock Puzzle. Provenance: `machine` — written with
 * AI assistance from the English source; no native speaker has read it
 * (docs/UNBLOCK_PUZZLE_RULES.md §15, docs/I18N_POLICY.md「翻訳の状態は来歴と
 * 検証できた事実で書く」). The title (`unblockPuzzleName`) is a proper noun and
 * stays as-is in every locale; placeholder names match the English source.
 * Shared words (Undo, Hint, Moves, Daily Challenge, …) follow the shell's
 * src/i18n/locales/hi.ts.
 */
import type { UnblockPuzzleMessages } from './en';

export const hi: UnblockPuzzleMessages = {
  unblockPuzzleName: 'Unblock Puzzle',
  unblockPuzzleChooseBoard: 'बोर्ड चुनें',
  unblockPuzzleDifficulty_easy: 'आसान',
  unblockPuzzleDifficulty_medium: 'मध्यम',
  unblockPuzzleDifficulty_hard: 'कठिन',
  unblockPuzzleRange: '{min}–{max} चालें',
  unblockPuzzleRangeOpen: '{min} या अधिक चालें',
  unblockPuzzleConfirmSwitchTitle: 'चालू बोर्ड बदलें?',
  unblockPuzzleConfirmSwitchBody: 'आपका {current} बोर्ड एक नए {next} बोर्ड से बदल दिया जाएगा।',
  unblockPuzzleBoardLabel: 'बोर्ड, {cols} गुणा {rows}। निकास पंक्ति {row} के दाएँ सिरे पर है।',
  unblockPuzzleBlockTarget:
    'लक्ष्य ब्लॉक, पंक्ति {row}, स्तंभ {from} से {to}। खाली खाने: बाएँ {left}, दाएँ {right}।',
  unblockPuzzleBlockH:
    'आड़ा ब्लॉक, पंक्ति {row}, स्तंभ {from} से {to}। खाली खाने: बाएँ {left}, दाएँ {right}।',
  unblockPuzzleBlockV:
    'खड़ा ब्लॉक, स्तंभ {col}, पंक्ति {from} से {to}। खाली खाने: ऊपर {up}, नीचे {down}।',
  unblockPuzzleMovesStatus: 'चालें {moves} · न्यूनतम {min}',
  unblockPuzzleMoveLeft: 'बाएँ खिसकाएँ',
  unblockPuzzleMoveRight: 'दाएँ खिसकाएँ',
  unblockPuzzleMoveUp: 'ऊपर खिसकाएँ',
  unblockPuzzleMoveDown: 'नीचे खिसकाएँ',
  unblockPuzzleSelectPrompt: 'खिसकाने के लिए ब्लॉक पर टैप करें',
  unblockPuzzleHintTarget: 'संकेत: लक्ष्य ब्लॉक को स्तंभ {toFrom}–{toTo} पर खिसकाएँ।',
  unblockPuzzleHintH:
    'संकेत: पंक्ति {row} में स्तंभ {from}–{to} वाले ब्लॉक को स्तंभ {toFrom}–{toTo} पर खिसकाएँ।',
  unblockPuzzleHintV:
    'संकेत: स्तंभ {col} में पंक्ति {from}–{to} वाले ब्लॉक को पंक्ति {toFrom}–{toTo} पर खिसकाएँ।',
  unblockPuzzleHintShown: 'चिह्नित ब्लॉक को बिंदीदार रूपरेखा तक खिसकाएँ।',
  unblockPuzzleHintNone: 'यहाँ से कोई चाल नहीं मिली।',
  unblockPuzzleSolvedTitle: 'पूरा हुआ!',
  unblockPuzzleSolvedBody: 'लक्ष्य ब्लॉक बाहर निकल गया।',
  unblockPuzzleSolvedOptimal: 'सबसे कम संभव चालों में बाहर निकला।',
  unblockPuzzleFewestLabel: 'न्यूनतम चालें',
  unblockPuzzleNetCellsLabel: 'शुद्ध खिसके खाने',
  unblockPuzzleHintsUsed: 'इस्तेमाल किए गए संकेत',
  unblockPuzzleNewBestTime: '{difficulty} में आपका सबसे तेज़ समय।',
  unblockPuzzleNewBestDailyMoves: 'आज के बोर्ड पर आपकी सबसे कम चालें।',
  unblockPuzzleNewBoard: 'नया बोर्ड',
  unblockPuzzleSolvedCount: 'पूरे किए गए बोर्ड',
  unblockPuzzleOptimalCount: 'न्यूनतम चालों में पूरे',
  unblockPuzzleOverallSection: 'कुल मिलाकर',
  unblockPuzzleDailiesCleared: 'पूरे किए गए डेली चैलेंज',
  unblockPuzzleStep1Title: 'अपनी रेखा पर खिसकाएँ',
  unblockPuzzleStep1Body: 'हर ब्लॉक सिर्फ़ अपनी रेखा पर खिसकता है: दाएँ-बाएँ, या ऊपर-नीचे।',
  unblockPuzzleStep2Title: 'लक्ष्य को निकालें',
  unblockPuzzleStep2Body:
    'बोर्ड पूरा करने के लिए लक्ष्य ब्लॉक को दाईं ओर के निकास से बाहर खिसकाएँ।',
  unblockPuzzleStep3Title: 'एक बार खिसकाना, एक चाल',
  unblockPuzzleStep3Body:
    'ब्लॉक कितनी भी दूर खिसके, वह एक चाल गिनी जाती है, और अनडू व संकेत हमेशा मौजूद हैं।',
};
