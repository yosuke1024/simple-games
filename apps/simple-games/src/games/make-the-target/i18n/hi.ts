/**
 * Hindi catalog for Make the Target — written by AI from the English source
 * on 2026-10-21 (provenance `machine`, docs/MAKE_THE_TARGET_RULES.md §13). No
 * native speaker has read it; it is not to be treated as reviewed. The title
 * (`makeTheTargetName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source.
 *
 * Terms: problem = सवाल, target = लक्ष्य (not गोल or स्कोर), solution = हल, the
 * result of one move = परिणाम. Expressions are read जमा / घटा / गुणा / भाग, left
 * term first ("8 भाग 2 बराबर 4" divides 8). Shared words follow the shell and
 * Bridges (आसान / मध्यम / कठिन, दैनिक, पूरे किए दिन).
 */
import type { MakeTheTargetMessages } from './en';

export const hi: MakeTheTargetMessages = {
  makeTheTargetName: 'Make the Target',
  makeTheTargetChooseTier: 'कठिनाई चुनें',
  makeTheTargetDifficulty_easy: 'आसान',
  makeTheTargetDifficulty_medium: 'मध्यम',
  makeTheTargetDifficulty_hard: 'कठिन',
  makeTheTargetTierNote_easy: '4 संख्याएँ',
  makeTheTargetTierNote_medium: '4 या 5 संख्याएँ',
  makeTheTargetTierNote_hard: '5 संख्याएँ',
  makeTheTargetConfirmSwitchTitle: 'चल रहा सवाल बदलें?',
  makeTheTargetConfirmSwitchBody: 'आपका {current} सवाल नए {next} सवाल से बदल दिया जाएगा।',
  makeTheTargetNumbersLabel: 'संख्याएँ',
  makeTheTargetTargetSpoken: 'लक्ष्य {target}',
  makeTheTargetTargetLabel: 'लक्ष्य',
  makeTheTargetOperatorsLabel: 'गणित के चिह्न',
  makeTheTargetOp_add: 'जोड़ें',
  makeTheTargetOp_subtract: 'घटाएँ',
  makeTheTargetOp_multiply: 'गुणा करें',
  makeTheTargetOp_divide: 'भाग दें',
  makeTheTargetSpokenLine_add: '{left} जमा {right} बराबर {result}',
  makeTheTargetSpokenLine_subtract: '{left} घटा {right} बराबर {result}',
  makeTheTargetSpokenLine_multiply: '{left} गुणा {right} बराबर {result}',
  makeTheTargetSpokenLine_divide: '{left} भाग {right} बराबर {result}',
  makeTheTargetSpokenUndo: 'वापस लिया गया: {line}',
  makeTheTargetStepsLabel: 'अब तक के कदम',
  makeTheTargetMissed: 'इससे {value} बनता है, {target} नहीं।',
  makeTheTargetSpokenMissed: '{line}। इससे {value} बनता है, {target} नहीं।',
  makeTheTargetShowSolution: 'एक हल देखें',
  makeTheTargetRevealTitle: 'एक हल देखें?',
  makeTheTargetRevealBody: 'यह सवाल यहीं खत्म होगा और हल किया हुआ नहीं गिना जाएगा।',
  makeTheTargetRevealConfirm: 'देखें',
  makeTheTargetSolvedTitle: 'लक्ष्य बन गया।',
  makeTheTargetRevealedTitle: '{target} बनाने का एक तरीका',
  makeTheTargetSolutionLabel: 'एक हल',
  makeTheTargetNewBoard: 'नया सवाल',
  makeTheTargetNewBestTime: 'आपका सबसे तेज़ समय।',
  makeTheTargetSolvedCount: 'हल किए सवाल',
  makeTheTargetDailySection: 'दैनिक',
  makeTheTargetDailiesCleared: 'पूरे किए दिन',
  makeTheTargetAllModes: 'सभी मोड',
  makeTheTargetStep1Title: 'दो को मिलाएँ',
  makeTheTargetStep1Body:
    'एक संख्या, फिर + − × या ÷, फिर दूसरी संख्या टैप करें\u00a0— पहले टैप की गई संख्या बाईं ओर रहती है।',
  makeTheTargetStep2Title: 'नई संख्या',
  makeTheTargetStep2Body:
    'वे दोनों इस्तेमाल हो जाती हैं, और परिणाम\u00a0— हमेशा शून्य से बड़ी पूर्ण संख्या\u00a0— उनकी जगह ले लेता है।',
  makeTheTargetStep3Title: 'लक्ष्य तक पहुँचें',
  makeTheTargetStep3Body:
    'सभी संख्याएँ इस्तेमाल करें। आखिरी संख्या लक्ष्य के बराबर होते ही सवाल हल हो जाता है।',
};
