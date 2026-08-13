import type { LudoMessages } from './en';

export const hi: LudoMessages = {
  ludoName: 'Ludo',
  ludoChooseOpponent: 'अपना प्रतिद्वंद्वी चुनें',
  ludoDifficulty_easy: 'आसान',
  ludoDifficulty_normal: 'सामान्य',
  ludoDifficulty_hard: 'कठिन',
  ludoRecordNote: '{wins} जीत · {losses} हार',
  ludoConfirmSwitchTitle: 'चालू मैच बदलें?',
  ludoConfirmSwitchBody: 'आपका {current} मैच नए {next} मैच से बदल जाएगा।',

  // ---- the board ----
  ludoBoardLabel: 'लूडो बोर्ड',
  ludoYou: 'आप',
  ludoCpu: 'CPU {n}',
  ludoSeatHome: '4 में से {home} घर पहुंचीं',
  ludoSafeSquare: 'सुरक्षित खाना',
  // Where a pawn is, in words. Composed into the two labels below so a seat, a
  // square and a state are each translated once.
  ludoWhereYard: 'यार्ड में',
  ludoWhereSquare: 'खाना नंबर {n} पर',
  ludoWhereSafe: 'सुरक्षित खाना नंबर {n} पर',
  ludoWhereColumn: 'होम कॉलम के खाना नंबर {n} पर',
  ludoWhereHome: 'घर पहुंच चुकी',
  ludoPawnAt: '{seat}, {where}',
  ludoMovePawn: '{where} अपनी गोटी चलाएं',

  // ---- the die and the turn ----
  ludoRollAction: 'फेंकें',
  ludoRollLabel: 'पासा फेंकें',
  ludoDieLabel: 'पासे पर {die} है',
  ludoDieUnrolled: 'अभी तक पासा नहीं फेंका गया',
  ludoTurnRoll: 'आपकी बारी है — पासा फेंकें।',
  ludoTurnMove: 'आपने {die} फेंका। चलाने के लिए किसी गोटी पर टैप करें।',
  ludoTurnCpu: 'CPU {n} खेल रहा है…',
  ludoAutoPass: 'इस अंक पर कोई गोटी नहीं चल सकती — बारी आगे बढ़ जाती है।',
  ludoThirdSix: 'लगातार तीन बार छक्का — यह बारी यहीं खत्म।',
  ludoRollAgain: 'छक्का आया — फिर से फेंकें।',

  // ---- the end of a match ----
  ludoWinTitle: 'आप जीत गए!',
  ludoWinBody: 'आपकी चारों गोटियां घर पहुंच चुकी हैं।',
  ludoLoseTitle: 'CPU {n} जीता',
  ludoLoseBody: 'उनकी चारों गोटियां घर पहुंच चुकी हैं। अगला मैच मुफ़्त है।',
  ludoNoContestTitle: 'कोई नतीजा नहीं',
  ludoNoContestBody:
    'बिना किसी के घर पहुंचे मैच फेंकने की सीमा तक पहुंच गया। यह खेला गया मैच गिना जाता है, पर न जीत में गिना जाता है न हार में।',
  ludoWins: 'जीत',
  ludoLosses: 'हार',

  // ---- Quick Rules (docs/LUDO_RULES.md §11) ----
  ludoStep1Title: 'छक्के से गोटी बाहर आती है',
  ludoStep1Body:
    'पासा फेंकें, फिर चलाने के लिए किसी गोटी पर टैप करें। सिर्फ वही गोटियां टैप की जा सकती हैं जिन्हें नियम इजाज़त देते हैं — बाकी वहीं रहती हैं।',
  ludoStep2Title: 'छक्के पर एक और फेंक',
  ludoStep2Body:
    'छक्का आने पर आप एक बार और फेंक सकते हैं। लेकिन लगातार तीन छक्कों पर, बिना कुछ चलाए बारी आगे बढ़ जाती है।',
  ludoStep3Title: 'विरोधी की गोटी पर उतरने से वह वापस भेज दी जाती है',
  ludoStep3Body:
    'उस खाने पर मौजूद विरोधी की सभी गोटियां तुरंत उनके यार्ड में वापस चली जाती हैं। सुरक्षित खानों पर यह नहीं होता। गोटी मारने पर कोई अतिरिक्त फेंक नहीं मिलती — अतिरिक्त फेंक सिर्फ छक्के से मिलती है।',
  ludoStep4Title: 'अपनी गोटियां एक साथ रखने से कोई बचाव नहीं होता',
  ludoStep4Body:
    'एक ही खाने पर आपकी दो गोटियां न किसी को रोकती हैं, न कोई बचाव करती हैं। अगर कोई विरोधी वहां उतरे, तो पूरा ढेर एक साथ यार्ड में वापस चला जाता है — यानी ढेर एक निशाना है, किला नहीं।',
  ludoStep5Title: 'घर पहुंचने के लिए ठीक अंक चाहिए',
  ludoStep5Body:
    'जो फेंक घर से आगे निकल जाए, वह गोटी बिल्कुल नहीं चलती। जीतने के लिए चारों गोटियां घर पहुंचाएं। हर अंक मैच के सीड से आता है, छहों अंकों की संभावना बराबर है, और किसी भी सीट के लिए पासा अलग तरह से नहीं फेंका जाता।',
};
