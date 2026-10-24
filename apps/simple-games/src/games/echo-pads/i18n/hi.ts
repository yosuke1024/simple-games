/**
 * Echo Pads — the हिन्दी catalog. Provenance (docs/ECHO_PADS_RULES.md §14):
 * `machine` — written by an AI from the English source on 2026-10-22; nobody
 * has read it, native speaker or author. The title (`echoPadsName`) stays
 * "Echo Pads".
 *
 * Terms (§14's glossary): पैड (pad), क्रम (sequence), लंबाई (length), चलाएँ / फिर से सुनें / रोकें, गति: धीमी / सामान्य / तेज़.
 */
import type { EchoPadsMessages } from './en';

export const hi: EchoPadsMessages = {
  echoPadsName: 'Echo Pads',
  echoPadsTier_4: '4 पैड',
  echoPadsTier_6: '6 पैड',
  echoPadsLength: 'लंबाई {n}',
  echoPadsLevelDetail: '{tier} · लंबाई {length}',
  echoPadsPace: 'गति',
  echoPadsPace_calm: 'धीमी',
  echoPadsPace_normal: 'सामान्य',
  echoPadsPace_quick: 'तेज़',
  echoPadsPlay: 'चलाएँ',
  echoPadsListenAgain: 'फिर से सुनें',
  echoPadsStop: 'रोकें',
  echoPadsRound: 'लंबाई {k} / {target}',
  echoPadsStatusIdle: '{k} पैड सुनने के लिए चलाएँ दबाएँ।',
  echoPadsStatusPlaying: '{k} पैड चल रहे हैं…',
  echoPadsStatusYourTurn: 'आपकी बारी: {k} पैड उसी क्रम में टैप करें।',
  echoPadsStatusAgain: 'सभी {k} पैड पहले से फिर से टैप करें।',
  echoPadsStatusReview: 'इस राउंड के {k} पैड फिर से चल रहे हैं…',
  echoPadsMark_circle: 'वृत्त',
  echoPadsMark_triangle: 'त्रिभुज',
  echoPadsMark_square: 'वर्ग',
  echoPadsMark_star: 'तारा',
  echoPadsMark_diamond: 'हीरा आकार',
  echoPadsMark_cross: 'क्रॉस',
  echoPadsPos_topLeft: 'ऊपर बाएँ',
  echoPadsPos_topMiddle: 'ऊपर बीच में',
  echoPadsPos_topRight: 'ऊपर दाएँ',
  echoPadsPos_bottomLeft: 'नीचे बाएँ',
  echoPadsPos_bottomMiddle: 'नीचे बीच में',
  echoPadsPos_bottomRight: 'नीचे दाएँ',
  echoPadsPadLabel: '{mark}, {position}',
  echoPadsPadsLabel: 'पैड',
  echoPadsExpectedLabel: '{pad} (अगला आने वाला पैड)',
  echoPadsMissTitle: 'यह दौर लंबाई {k} पर समाप्त हुआ',
  echoPadsMissBody: '{k} में से पैड {index} था: {pad}।',
  echoPadsResultTitle: 'सभी {n} लौटाए',
  echoPadsLongest: 'सबसे लंबा लौटाया',
  echoPadsLongestNone: 'कोई नहीं',
  echoPadsReplays: 'फिर से सुना',
  echoPadsPacesHeard: 'गति',
  echoPadsNewSequence: 'नया क्रम',
  echoPadsLevelCell: '{level}, {detail}',
  echoPadsLevelCellCleared: '{level}, {detail}, पूरा',
  echoPadsReplaceTitle: 'चल रहे दौर को बदलें?',
  echoPadsReplaceBody: '{current} का दौर {next} के नए दौर से बदल दिया जाएगा।',
  echoPadsStatStarted: 'शुरू किए गए दौर',
  echoPadsStatCleared: 'पूरे किए',
  echoPadsStatMissed: 'गलती से समाप्त',
  echoPadsStatLevels: 'पूरे किए गए लेवल',
  echoPadsStatDays: 'पूरे किए गए दिन',
  echoPadsStep1Title: 'सुनें',
  echoPadsStep1Body:
    '▶ दबाएँ, पैड एक-एक करके चमकते और बजते हैं — क्रम याद रखें (पहले टैप से पहले आप जितनी बार चाहें फिर से सुन सकते हैं)।',
  echoPadsStep2Title: 'दोहराएँ',
  echoPadsStep2Body: 'फिर पैड को उसी क्रम में टैप करें।',
  echoPadsStep3Title: 'बढ़ाएँ',
  echoPadsStep3Body: 'हर बार लौटाने पर क्रम एक बढ़ जाता है — कोई समय सीमा नहीं।',
};
