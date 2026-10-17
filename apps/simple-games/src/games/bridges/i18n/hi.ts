/**
 * Hindi catalog for Bridges. Provenance (docs/BRIDGES_RULES.md §14,
 * docs/I18N_POLICY.md): `machine` — written with AI assistance and **not read
 * by a native speaker**. The title (`bridgesName`) is a proper noun and stays
 * as-is in every locale; placeholder names match the English source.
 */
import type { BridgesMessages } from './en';

export const hi: BridgesMessages = {
  bridgesName: 'Bridges',
  bridgesChooseBoard: 'बोर्ड चुनें',
  bridgesDifficulty_easy: 'आसान',
  bridgesDifficulty_medium: 'मध्यम',
  bridgesDifficulty_hard: 'कठिन',
  bridgesBoardNote: '{width}×{height}',
  bridgesConfirmSwitchTitle: 'चालू बोर्ड बदलें?',
  bridgesConfirmSwitchBody: 'आपका {current} बोर्ड नए {next} बोर्ड से बदल दिया जाएगा।',
  bridgesBoardLabel: 'Bridges बोर्ड, {width} गुणा {height}, {islands} द्वीप',
  bridgesIslandOpen: 'द्वीप {value}, पंक्ति {row}, स्तंभ {col}: {value} में से {count} पुल',
  bridgesIslandComplete: 'द्वीप {value}, पंक्ति {row}, स्तंभ {col}: पूरा',
  bridgesIslandOver: 'द्वीप {value}, पंक्ति {row}, स्तंभ {col}: {count} पुल, ज़रूरत से ज़्यादा',
  bridgesIslandSelected: '{island}। चुना गया',
  bridgesIslandPartner: '{island}। चुने गए द्वीप से जुड़ सकता है: 2 में से {bridges} पुल',
  bridgesIslandHinted: '{island}। संकेत से हाइलाइट किया गया',
  bridgesIslandHintRing: '{island}। संकेत से हाइलाइट किया गया, बिंदुदार घेरे में',
  bridgesAnnounceNone:
    'पंक्ति {row1}, स्तंभ {col1} और पंक्ति {row2}, स्तंभ {col2} के बीच कोई पुल नहीं',
  bridgesAnnounceOne: 'पंक्ति {row1}, स्तंभ {col1} और पंक्ति {row2}, स्तंभ {col2} के बीच एक पुल',
  bridgesAnnounceTwo: 'पंक्ति {row1}, स्तंभ {col1} और पंक्ति {row2}, स्तंभ {col2} के बीच दो पुल',
  bridgesSplitNote:
    'हर संख्या पूरी हो गई, पर द्वीप {groups} समूहों में बँटे हैं। उन्हें एक में जोड़ें।',
  bridgesHintWrong: 'हाइलाइट किए गए द्वीपों के बीच पुल ज़्यादा हैं।',
  bridgesHintOne: 'हाइलाइट की गई जोड़ी को कम से कम एक पुल चाहिए।',
  bridgesHintTwo: 'हाइलाइट की गई जोड़ी को दो पुल चाहिए।',
  bridgesHintOneAt:
    'बिंदुदार घेरे वाले द्वीप से गिनें: हाइलाइट की गई जोड़ी को कम से कम एक पुल चाहिए।',
  bridgesHintTwoAt: 'बिंदुदार घेरे वाले द्वीप से गिनें: हाइलाइट की गई जोड़ी को दो पुल चाहिए।',
  bridgesHintNone: 'यहाँ से कोई पक्की चाल नहीं मिली।',
  bridgesHintWhere: 'हाइलाइट किए गए: पंक्ति {row1}, स्तंभ {col1} और पंक्ति {row2}, स्तंभ {col2}।',
  bridgesHintWhereRing:
    'हाइलाइट किए गए: पंक्ति {row1}, स्तंभ {col1} और पंक्ति {row2}, स्तंभ {col2}। बिंदुदार घेरा: पंक्ति {row}, स्तंभ {col}।',
  bridgesSolvedTitle: 'सब जुड़ गए!',
  bridgesSolvedBody: 'हर द्वीप एक ही नेटवर्क में जुड़ गया है।',
  bridgesHintsUsed: 'इस्तेमाल हुए संकेत',
  bridgesNewBestTime: 'आपका सबसे तेज़ समय।',
  bridgesNewBoard: 'नया बोर्ड',
  bridgesSolvedCount: 'हल किए बोर्ड',
  bridgesDailySection: 'दैनिक',
  bridgesDailiesCleared: 'पूरे किए दिन',
  bridgesAllModes: 'सभी मोड',
  bridgesStep1Title: 'संख्या जितने पुल',
  bridgesStep1Body: 'हर द्वीप पर ठीक उतने ही पुल लगते हैं जितनी उसकी संख्या है।',
  bridgesStep2Title: 'सीधे, अधिकतम दो',
  bridgesStep2Body:
    'पुल सीधे आड़े या खड़े चलते हैं, कभी एक-दूसरे को नहीं काटते, और एक ही जोड़ी के बीच अधिकतम दो होते हैं।',
  bridgesStep3Title: 'सबको जोड़ें',
  bridgesStep3Body:
    'एक द्वीप पर टैप करें, फिर घेरे वाले साथी द्वीप पर टैप करके पुल जोड़ें (फिर टैप करने पर दो, एक बार और पर शून्य), जब तक हर द्वीप जुड़ न जाए।',
};
