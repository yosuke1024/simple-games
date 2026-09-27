import type { CrownGridMessages } from './en';

export const hi: CrownGridMessages = {
  crownGridName: 'Crown Grid',
  crownGridChooseBoard: 'बोर्ड चुनें',
  crownGridDifficulty_easy: 'आसान',
  crownGridDifficulty_medium: 'मध्यम',
  crownGridDifficulty_hard: 'कठिन',
  crownGridBoardNote: '{size}×{size}',
  crownGridConfirmSwitchTitle: 'चालू बोर्ड बदलें?',
  crownGridConfirmSwitchBody: 'आपका {current} खेल नए {next} बोर्ड से बदल जाएगा।',
  crownGridBoardLabel: 'Crown Grid बोर्ड, {size}×{size}',
  crownGridCellEmpty: 'खाली, पंक्ति {row}, स्तंभ {col}, क्षेत्र {region}',
  crownGridCellCross: 'काटा हुआ, पंक्ति {row}, स्तंभ {col}, क्षेत्र {region}',
  crownGridCellCrown: 'ताज, पंक्ति {row}, स्तंभ {col}, क्षेत्र {region}',
  crownGridRuleBroken: 'नियम टूटा',
  crownGridHintViolation: 'हाइलाइट किए गए ताज एक नियम तोड़ रहे हैं।',
  crownGridHintWrong: 'चिह्नित ताज सही नहीं हो सकता।',
  crownGridHintSingle_row:
    'हाइलाइट की गई पंक्ति में अब उसके ताज के लिए सिर्फ एक खाना बचा है: घेरे वाला खाना।',
  crownGridHintSingle_col:
    'हाइलाइट किए गए स्तंभ में अब उसके ताज के लिए सिर्फ एक खाना बचा है: घेरे वाला खाना।',
  crownGridHintSingle_region:
    'हाइलाइट किए गए क्षेत्र में अब उसके ताज के लिए सिर्फ एक खाना बचा है: घेरे वाला खाना।',
  crownGridHintConfine_regionRow:
    'हाइलाइट किए गए क्षेत्र का ताज सिर्फ रंगीन खानों में से किसी एक में हो सकता है, और वे सभी एक ही पंक्ति में हैं — इसलिए उस पंक्ति के बाकी खाने (घेरे वाले) बाहर हो जाते हैं।',
  crownGridHintConfine_regionCol:
    'हाइलाइट किए गए क्षेत्र का ताज सिर्फ रंगीन खानों में से किसी एक में हो सकता है, और वे सभी एक ही स्तंभ में हैं — इसलिए उस स्तंभ के बाकी खाने (घेरे वाले) बाहर हो जाते हैं।',
  crownGridHintConfine_rowRegion:
    'हाइलाइट की गई पंक्ति का ताज सिर्फ रंगीन खानों में से किसी एक में हो सकता है, और वे सभी एक ही क्षेत्र में हैं — इसलिए उस क्षेत्र के बाकी खाने (घेरे वाले) बाहर हो जाते हैं।',
  crownGridHintConfine_colRegion:
    'हाइलाइट किए गए स्तंभ का ताज सिर्फ रंगीन खानों में से किसी एक में हो सकता है, और वे सभी एक ही क्षेत्र में हैं — इसलिए उस क्षेत्र के बाकी खाने (घेरे वाले) बाहर हो जाते हैं।',
  crownGridHintAttack_row:
    'घेरे वाले खाने पर ताज रखने से हर रंगीन खाना खारिज हो जाएगा, और हाइलाइट की गई पंक्ति के पास अपने ताज के लिए कोई जगह नहीं बचेगी।',
  crownGridHintAttack_col:
    'घेरे वाले खाने पर ताज रखने से हर रंगीन खाना खारिज हो जाएगा, और हाइलाइट किए गए स्तंभ के पास अपने ताज के लिए कोई जगह नहीं बचेगी।',
  crownGridHintAttack_region:
    'घेरे वाले खाने पर ताज रखने से हर रंगीन खाना खारिज हो जाएगा, और हाइलाइट किए गए क्षेत्र के पास अपने ताज के लिए कोई जगह नहीं बचेगी।',
  crownGridHintPair_regionsRows:
    'दोनों हाइलाइट किए गए क्षेत्रों के ताज सिर्फ रंगीन खानों में हो सकते हैं, जो ठीक दो पंक्तियों में समाते हैं — इसलिए उन पंक्तियों के बाकी खाने (घेरे वाले) बाहर हो जाते हैं।',
  crownGridHintPair_regionsCols:
    'दोनों हाइलाइट किए गए क्षेत्रों के ताज सिर्फ रंगीन खानों में हो सकते हैं, जो ठीक दो स्तंभों में समाते हैं — इसलिए उन स्तंभों के बाकी खाने (घेरे वाले) बाहर हो जाते हैं।',
  crownGridHintPair_rowsRegions:
    'दोनों हाइलाइट की गई पंक्तियों के ताज सिर्फ रंगीन खानों में हो सकते हैं, जो ठीक दो क्षेत्रों में समाते हैं — इसलिए उन क्षेत्रों के बाकी खाने (घेरे वाले) बाहर हो जाते हैं।',
  crownGridHintPair_colsRegions:
    'दोनों हाइलाइट किए गए स्तंभों के ताज सिर्फ रंगीन खानों में हो सकते हैं, जो ठीक दो क्षेत्रों में समाते हैं — इसलिए उन क्षेत्रों के बाकी खाने (घेरे वाले) बाहर हो जाते हैं।',
  crownGridHintHypothesis_row:
    'घेरे वाले खाने पर ताज रखकर देखें: इससे मजबूर हुई चालें हाइलाइट की गई पंक्ति के लिए ताज की कोई जगह नहीं छोड़तीं, इसलिए यह वहाँ नहीं हो सकता।',
  crownGridHintHypothesis_col:
    'घेरे वाले खाने पर ताज रखकर देखें: इससे मजबूर हुई चालें हाइलाइट किए गए स्तंभ के लिए ताज की कोई जगह नहीं छोड़तीं, इसलिए यह वहाँ नहीं हो सकता।',
  crownGridHintHypothesis_region:
    'घेरे वाले खाने पर ताज रखकर देखें: इससे मजबूर हुई चालें हाइलाइट किए गए क्षेत्र के लिए ताज की कोई जगह नहीं छोड़तीं, इसलिए यह वहाँ नहीं हो सकता।',
  crownGridHintNone: 'अभी कोई निश्चित चाल नहीं मिली।',
  crownGridSolvedTitle: 'हल हो गया!',
  crownGridSolvedBody: 'हर पंक्ति, हर स्तंभ और हर क्षेत्र में एक ताज है।',
  crownGridHintsUsed: 'इस्तेमाल हुए संकेत',
  crownGridNewBestTime: 'आपका अब तक का सबसे तेज़ समय।',
  crownGridNewBoard: 'नया बोर्ड',
  crownGridDailySection: 'दैनिक',
  crownGridDailiesSolved: 'हल किए दिन',
  crownGridDailyBacklogHint: 'पिछले दिन हमेशा खुले रहते हैं।',
  crownGridStep1Title: 'हर एक में एक ताज',
  crownGridStep1Body: 'हर पंक्ति, हर स्तंभ और हर रंग में ठीक एक ताज होता है।',
  crownGridStep2Title: 'ताज कभी छूते नहीं',
  crownGridStep2Body: 'दो ताज कभी अगल-बगल नहीं होते, तिरछे भी नहीं।',
  crownGridStep3Title: 'टैप और ड्रैग',
  crownGridStep3Body:
    'खाने को टैप करें: ×, ताज, खाली बदलता है; कई × लगाने के लिए ड्रैग करें। अटक गए? संकेत माँगें।',
};
