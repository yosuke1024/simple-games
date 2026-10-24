/**
 * Hindi catalog for Loop Puzzle — written with AI assistance from the
 * English source (provenance `machine`, docs/LOOP_PUZZLE_RULES.md §14). No
 * native speaker has read it; it is not to be treated as reviewed. The title
 * (`loopPuzzleName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source. Terms follow the shell
 * (`hint` = संकेत) and Box Regions (board = बोर्ड); an edge is a किनारा, a
 * drawn edge a रेखा, a dot a बिंदु, the loop a लूप.
 */
import type { LoopPuzzleMessages } from './en';

export const hi: LoopPuzzleMessages = {
  loopPuzzleName: 'Loop Puzzle',
  loopPuzzleChooseBoard: 'बोर्ड चुनें',
  loopPuzzleDifficulty_easy: 'आसान',
  loopPuzzleDifficulty_medium: 'मध्यम',
  loopPuzzleDifficulty_hard: 'कठिन',
  loopPuzzleBoardNote: '{width}×{height}',
  loopPuzzleConfirmSwitchTitle: 'चालू बोर्ड बदलें?',
  loopPuzzleConfirmSwitchBody: 'आपका {current} गेम नए {next} बोर्ड से बदल दिया जाएगा।',
  loopPuzzleBoardLabel: 'Loop Puzzle बोर्ड, {width} गुणा {height}',
  loopPuzzleEdgeHEmpty: 'क्षैतिज किनारा, पंक्ति {row}, स्तंभ {col}, खाली',
  loopPuzzleEdgeHLine: 'क्षैतिज किनारा, पंक्ति {row}, स्तंभ {col}, रेखा',
  loopPuzzleEdgeHCross: 'क्षैतिज किनारा, पंक्ति {row}, स्तंभ {col}, × लगा',
  loopPuzzleEdgeVEmpty: 'खड़ा किनारा, पंक्ति {row}, स्तंभ {col}, खाली',
  loopPuzzleEdgeVLine: 'खड़ा किनारा, पंक्ति {row}, स्तंभ {col}, रेखा',
  loopPuzzleEdgeVCross: 'खड़ा किनारा, पंक्ति {row}, स्तंभ {col}, × लगा',
  loopPuzzleClueOpen: 'संख्या {n}, पंक्ति {row}, स्तंभ {col}',
  loopPuzzleClueMet: 'संख्या {n}, पंक्ति {row}, स्तंभ {col}, पूरी',
  loopPuzzleClueTooMany: 'संख्या {n}, पंक्ति {row}, स्तंभ {col}, रेखाएँ ज़्यादा',
  loopPuzzleClueTooFew: 'संख्या {n}, पंक्ति {row}, स्तंभ {col}, अब पूरी नहीं हो सकती',
  loopPuzzleNoteHint: 'संकेत द्वारा चिह्नित',
  loopPuzzleNoteConflict: 'नियम टूट रहा है',
  loopPuzzleConflictBranch: 'एक बिंदु पर दो से ज़्यादा रेखाएँ हैं।',
  loopPuzzleConflictDeadEnd: 'एक रेखा ऐसे बिंदु पर रुकती है जहाँ से आगे रास्ता नहीं।',
  loopPuzzleConflictLoop: 'एक बंद लूप के बाहर दूसरी रेखाएँ भी हैं।',
  loopPuzzleConflictTooMany: 'एक संख्या पर उसके मान से ज़्यादा रेखाएँ हैं।',
  loopPuzzleConflictTooFew: 'एक संख्या को अब पर्याप्त रेखाएँ नहीं मिल सकतीं।',
  loopPuzzleConflictClosed: 'लूप बंद है, पर एक संख्या मेल नहीं खाती।',
  loopPuzzleHintWrongLine: 'चिह्नित रेखा लूप का हिस्सा नहीं है।',
  loopPuzzleHintWrongCross: 'लूप चिह्नित × से होकर गुज़रता है।',
  loopPuzzleHintCellLine: 'घेरी गई संख्या को चिह्नित किनारे पर रेखा चाहिए।',
  loopPuzzleHintCellCross: 'घेरी गई संख्या चिह्नित किनारे पर रेखा की जगह नहीं छोड़ती।',
  loopPuzzleHintDotLine: 'घेरे गए बिंदु पर लूप को चिह्नित किनारे से जाना होगा।',
  loopPuzzleHintDotCross: 'घेरे गए बिंदु पर चिह्नित किनारा रेखा नहीं हो सकता।',
  loopPuzzleHintLoopCross: 'चिह्नित किनारे पर रेखा लूप को बहुत जल्दी बंद कर देगी।',
  loopPuzzleHintClosedCross: 'लूप बंद है, इसलिए चिह्नित किनारा उसका हिस्सा नहीं है।',
  loopPuzzleHintTrialLine: 'चिह्नित किनारे पर रेखा न हो, तो विरोधाभास होता है।',
  loopPuzzleHintTrialCross: 'चिह्नित किनारे पर रेखा खींचने से विरोधाभास होता है।',
  loopPuzzleHintRevealLine: 'चिह्नित किनारा लूप का हिस्सा है।',
  loopPuzzleHintRevealCross: 'चिह्नित किनारा लूप का हिस्सा नहीं है।',
  loopPuzzleHintNone: 'अभी कोई संकेत नहीं है।',
  loopPuzzleSolvedTitle: 'हल हो गया!',
  loopPuzzleSolvedBody: 'एक बंद लूप, हर संख्या पूरी।',
  loopPuzzleHintsUsed: 'इस्तेमाल किए गए संकेत',
  loopPuzzleNewBestTime: 'अब तक का सबसे तेज़।',
  loopPuzzleNewBoard: 'नया बोर्ड',
  loopPuzzleSolvedCount: 'हल की गई पहेलियाँ',
  loopPuzzleDailySection: 'दैनिक',
  loopPuzzleDailiesCleared: 'पूरे किए गए दिन',
  loopPuzzleAllBoards: 'सभी बोर्ड',
  loopPuzzleStep1Title: 'एक बंद लूप',
  loopPuzzleStep1Body: 'बिंदुओं को जोड़कर एक बंद लूप बनाएँ, जो न कहीं बँटे और न खुद को काटे।',
  loopPuzzleStep2Title: 'संख्याएँ पढ़ें',
  loopPuzzleStep2Body: 'संख्या बताती है कि लूप उसके चारों किनारों में से कितनों से गुज़रता है।',
  loopPuzzleStep3Title: 'किनारे पर टैप करें',
  loopPuzzleStep3Body: 'हर टैप किनारे को रेखा, फिर × (लूप में नहीं), फिर खाली बना देता है।',
};
