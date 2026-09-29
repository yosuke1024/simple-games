/**
 * Hindi catalog for Sudoku 6×6 — a machine translation of the English
 * source, not yet reviewed (docs/I18N_POLICY.md). The title
 * (`sudoku6x6Name`) is a proper noun. Wording follows the 9×9 Sudoku
 * catalog wherever the meaning is the same.
 */
import type { Sudoku6x6Messages } from './en';

export const hi: Sudoku6x6Messages = {
  sudoku6x6Name: 'Sudoku 6×6',
  sudoku6x6ChooseBoard: 'बोर्ड चुनें',
  sudoku6x6Difficulty_easy: 'आसान',
  sudoku6x6Difficulty_medium: 'मध्यम',
  sudoku6x6Difficulty_hard: 'कठिन',
  sudoku6x6ConfirmSwitchTitle: 'चल रहे बोर्ड को बदलें?',
  sudoku6x6ConfirmSwitchBody: 'आपका {current} गेम नए {next} बोर्ड से बदल दिया जाएगा।',
  sudoku6x6GridLabel: 'सुडोकू 6×6 ग्रिड',
  sudoku6x6PadLabel: 'नंबर पैड',
  sudoku6x6PadKey: '{value}, {n} बाकी',
  sudoku6x6PadNoteKey: 'नोट {value}',
  sudoku6x6CellEmpty: 'खाली, पंक्ति {row}, स्तंभ {col}',
  sudoku6x6CellGiven: '{value}, दिया गया, पंक्ति {row}, स्तंभ {col}',
  sudoku6x6CellEntry: '{value}, पंक्ति {row}, स्तंभ {col}',
  sudoku6x6Erase: 'मिटाएँ',
  sudoku6x6Notes: 'नोट्स',
  sudoku6x6HintOnlyDigit: 'इस खाने में केवल एक ही अंक बैठता है।',
  sudoku6x6HintOnlyCell: 'यहाँ {value} केवल इसी खाने में आ सकता है।',
  sudoku6x6HintLockedLine: 'इस बॉक्स में {value} केवल हाइलाइट की गई रेखा पर बैठता है।',
  sudoku6x6HintLockedBox: 'इस रेखा पर {value} केवल हाइलाइट किए बॉक्स में बैठता है।',
  sudoku6x6HintRuledOut: 'ये खाने इकाई में कहीं और से अंक हटा देते हैं।',
  sudoku6x6HintNone: 'अभी कुछ तय नहीं किया जा सकता।',
  sudoku6x6SolvedTitle: 'हल हो गया!',
  sudoku6x6SolvedBody: 'हर पंक्ति, स्तंभ और बॉक्स में 1-6 हैं।',
  sudoku6x6Mistakes: 'गलतियाँ',
  sudoku6x6HintsUsed: 'इस्तेमाल किए संकेत',
  sudoku6x6NewBestTime: 'आपका सबसे तेज़ समय।',
  sudoku6x6NewBoard: 'नया बोर्ड',
  sudoku6x6DailySection: 'डेली',
  sudoku6x6DailiesSolved: 'हल किए गए दिन',
  sudoku6x6DailyBacklogHint: 'पिछले सभी दिन खुले रहते हैं।',
  sudoku6x6HighlightMistakes: 'गलतियाँ दिखाएँ',
  sudoku6x6HighlightMistakesNote:
    'गलत अंक रखते ही उस पर निशान लगाता है। दोहराए अंक हमेशा दिखते हैं।',
  sudoku6x6Step1Title: '1-6, हर एक बार',
  sudoku6x6Step1Body: 'हर पंक्ति, स्तंभ और 2×3 बॉक्स में 1 से 6 ठीक एक बार आते हैं।',
  sudoku6x6Step2Title: 'भरें और नोट करें',
  sudoku6x6Step2Body: 'कोई खाना चुनें और नंबर दबाएँ। उम्मीदवार लिखने के लिए नोट्स चालू करें।',
  sudoku6x6Step3Title: 'अटक गए? संकेत लें',
  sudoku6x6Step3Body: 'संकेत अगला वह खाना दिखाता है जिसका उत्तर पक्का है, और क्यों।',
};
