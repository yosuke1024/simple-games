/**
 * Hindi catalog of Number Path (docs/I18N_POLICY.md: provenance `machine` — written
 * with AI assistance and not yet read by a native speaker). The title is a proper
 * noun and stays as-is.
 */
import type { NumberPathMessages } from './en';

export const hi: NumberPathMessages = {
  numberPathName: 'Number Path',
  numberPathChooseBoard: 'बोर्ड चुनें',
  numberPathDifficulty_easy: 'आसान',
  numberPathDifficulty_medium: 'मध्यम',
  numberPathDifficulty_hard: 'कठिन',
  numberPathBoardNote: '{width}×{height}',
  numberPathBoardLabel: 'Number Path बोर्ड, {width} गुणा {height}',
  numberPathCellPlain: 'पंक्ति {row}, स्तंभ {col}',
  numberPathCellNumber: 'संख्या {n}, पंक्ति {row}, स्तंभ {col}',
  numberPathOnPath: 'रास्ते पर, चरण {step}',
  numberPathOffPath: 'रास्ते पर नहीं',
  numberPathHintNext: 'चिह्नित खाना अगला कदम है।',
  numberPathHintBack: 'रास्ता भटक गया है। चिह्नित खाने तक पीछे लौटें।',
  numberPathHintNone: 'अभी कोई संकेत नहीं है।',
  numberPathHintMarked: 'संकेत',
  numberPathSolvedTitle: 'हल हो गया!',
  numberPathSolvedBody: 'एक रेखा, हर खाना, क्रम में।',
  numberPathHintsUsed: 'इस्तेमाल किए संकेत',
  numberPathNewBestTime: 'आपका अब तक का सबसे तेज़।',
  numberPathNewBoard: 'नया बोर्ड',
  numberPathSolvedCount: 'हल किए बोर्ड',
  numberPathDailySection: 'दैनिक',
  numberPathDailiesSolved: 'हल किए दिन',
  numberPathDailyBacklogHint: 'हर पिछला दिन खुला रहता है।',
  numberPathStep1Title: 'संख्याओं का क्रम अपनाएँ',
  numberPathStep1Body: '1 से एक रेखा खींचें और संख्याओं को क्रम से पार करें।',
  numberPathStep2Title: 'हर खाना भरें',
  numberPathStep2Body: 'रेखा हर खाने से ठीक एक बार गुज़रती है और अंतिम संख्या पर समाप्त होती है।',
  numberPathStep3Title: 'दीवारें रास्ता रोकती हैं',
  numberPathStep3Body:
    'मोटी किनार पार नहीं की जा सकती; पीछे जाने के लिए रेखा पर उलटा खींचें या उस पर किसी खाने को छुएँ।',
};
