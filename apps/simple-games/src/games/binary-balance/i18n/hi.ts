/**
 * hi catalog for Binary Balance: a machine translation of the English
 * source, not yet reviewed by a native speaker (docs/I18N_POLICY.md). The
 * title (`binaryBalanceName`) is a proper noun and stays as-is; wording follows
 * the Takuzu catalog where the meaning is the same. The two marks are a sun
 * and a moon (the ordinary words for the celestial bodies).
 */
import type { BinaryBalanceMessages } from './en';

export const hi: BinaryBalanceMessages = {
  binaryBalanceName: 'Binary Balance',
  binaryBalanceChooseBoard: 'बोर्ड चुनें',
  binaryBalanceDifficulty_easy: 'आसान',
  binaryBalanceDifficulty_medium: 'मध्यम',
  binaryBalanceDifficulty_hard: 'कठिन',
  binaryBalanceBoardNote: '{size}×{size}',
  binaryBalanceConfirmSwitchTitle: 'चालू बोर्ड बदलें?',
  binaryBalanceConfirmSwitchBody: 'आपका {current} खेल नए {next} बोर्ड से बदल जाएगा।',
  binaryBalanceBoardLabel: 'Binary Balance बोर्ड, {size}×{size}',
  binaryBalanceCellEmpty: 'खाली, पंक्ति {row}, स्तंभ {col}',
  binaryBalanceCellSun: 'सूरज, पंक्ति {row}, स्तंभ {col}',
  binaryBalanceCellMoon: 'चाँद, पंक्ति {row}, स्तंभ {col}',
  binaryBalanceCellFixedSun: 'दिया गया सूरज, पंक्ति {row}, स्तंभ {col}',
  binaryBalanceCellFixedMoon: 'दिया गया चाँद, पंक्ति {row}, स्तंभ {col}',
  binaryBalanceLinkSameRight: 'दाईं ओर के खाने जैसा',
  binaryBalanceLinkDiffRight: 'दाईं ओर के खाने से अलग',
  binaryBalanceLinkSameBelow: 'नीचे के खाने जैसा',
  binaryBalanceLinkDiffBelow: 'नीचे के खाने से अलग',
  binaryBalanceRuleBroken: 'नियम टूटा',
  binaryBalanceMarkSun: 'सूरज',
  binaryBalanceMarkMoon: 'चाँद',
  binaryBalanceHintViolation: 'हाइलाइट किए खाने नियम तोड़ रहे हैं।',
  binaryBalanceHintWrong: 'आउटलाइन वाला चिह्न सही नहीं हो सकता।',
  binaryBalanceHintPairGap:
    'रंगीन जोड़ी से लगातार तीन हो जाएँगे, इसलिए आउटलाइन वाला खाना {mark} है।',
  binaryBalanceHintLineCount:
    'हाइलाइट की गई पंक्ति या स्तंभ में रंगीन चिह्न अपने आधे हिस्से तक पहुँच चुका है, इसलिए आउटलाइन वाला खाना {mark} है।',
  binaryBalanceHintLinkSame:
    '= आउटलाइन वाले खाने को रंगीन खाने से जोड़ता है, इसलिए यह भी {mark} है।',
  binaryBalanceHintLinkDiff:
    '× आउटलाइन वाले खाने को रंगीन खाने से जोड़ता है, इसलिए इसमें दूसरा चिह्न आता है: {mark}।',
  binaryBalanceHintLineCompletion:
    'हाइलाइट की गई पंक्ति या स्तंभ को पूरा करने के हर तरीके में आउटलाइन वाले खाने में {mark} आता है।',
  binaryBalanceHintHypothesis:
    'अगर आउटलाइन वाला खाना {other} होता, तो आगे की चालें नियम तोड़ देतीं, इसलिए यह {mark} है।',
  binaryBalanceHintNone: 'अभी कोई निश्चित चाल नहीं मिली।',
  binaryBalanceSolvedTitle: 'हल हो गया!',
  binaryBalanceSolvedBody: 'हर पंक्ति और हर स्तंभ संतुलित है, और हर कड़ी सही है।',
  binaryBalanceHintsUsed: 'इस्तेमाल हुए संकेत',
  binaryBalanceNewBestTime: 'आपका सबसे तेज़ समय।',
  binaryBalanceNewBoard: 'नया बोर्ड',
  binaryBalanceDailySection: 'डेली',
  binaryBalanceDailiesSolved: 'हल किए दिन',
  binaryBalanceDailyBacklogHint: 'पिछले दिन हमेशा खुले रहते हैं।',
  binaryBalanceStep1Title: 'लगातार तीन नहीं',
  binaryBalanceStep1Body:
    'खाने पर टैप करने से खाली, सूरज, चाँद बदलते हैं। एक ही चिह्न लगातार तीन बार नहीं आ सकता।',
  binaryBalanceStep2Title: 'आधा-आधा',
  binaryBalanceStep2Body: 'हर पंक्ति और हर स्तंभ में जितने सूरज होते हैं उतने ही चाँद होते हैं।',
  binaryBalanceStep3Title: 'कड़ियों का पालन करें',
  binaryBalanceStep3Body:
    '= से जुड़े खाने एक जैसे होते हैं; × से जुड़े खाने अलग होते हैं। अटक गए? संकेत माँगें।',
};
