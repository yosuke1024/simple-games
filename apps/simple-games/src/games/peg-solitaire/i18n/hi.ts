/**
 * Peg Solitaire — the Hindi catalog. Provenance (docs/PEG_SOLITAIRE_RULES.md
 * §15): `machine` — written by an AI from the English source; no native
 * speaker has read it. The title (`pegSolitaireName`) is a proper noun and
 * stays as-is. The English board is "ब्रिटिश" here, for the same reason as
 * the Japanese catalog: a button reading "अंग्रेज़ी" would look like a
 * language switch. Pieces are "गोटी", as in the Ludo and Reversi catalogs.
 */
import type { PegSolitaireMessages } from './en';

export const hi: PegSolitaireMessages = {
  pegSolitaireName: 'Peg Solitaire',

  pegSolitaireBoard_english: 'ब्रिटिश',
  pegSolitaireBoard_triangle: 'त्रिकोण',
  pegSolitaireBoardLabel_english: 'ब्रिटिश बोर्ड, 33 छेद',
  pegSolitaireBoardLabel_triangle: 'त्रिकोण बोर्ड, 15 छेद',
  pegSolitaireHoleCount: '{count} छेद',

  pegSolitaireChooseBoard: 'बोर्ड चुनें',
  pegSolitaireBestNote: 'सबसे कम बचीं: {count}',
  pegSolitaireConfirmSwitchTitle: 'चालू खेल बदलें?',
  pegSolitaireConfirmSwitchBody: 'आपका {current} खेल नए {next} खेल से बदल जाएगा।',

  pegSolitaireHoleGrid: 'पंक्ति {row}, स्तंभ {col}: {content}',
  pegSolitaireHoleRow: 'पंक्ति {row}, छेद {place}: {content}',
  pegSolitaireContentPeg: 'गोटी',
  pegSolitaireContentPegRing: 'घेरे वाले छेद में गोटी',
  pegSolitaireContentEmpty: 'खाली',
  pegSolitaireContentEmptyRing: 'घेरे वाला खाली छेद',
  pegSolitaireContentLanding: 'खाली, यहाँ कूदकर पहुँच सकते हैं',
  pegSolitaireContentLandingRing: 'घेरे वाला खाली छेद, यहाँ कूदकर पहुँच सकते हैं',

  pegSolitairePegsLeft: 'बची गोटियाँ: {count}',
  pegSolitaireNoJump: 'यह गोटी अभी कूद नहीं सकती।',

  pegSolitairePerfectTitle: 'पूर्ण जीत!',
  pegSolitairePerfectBody: 'आख़िरी गोटी घेरे वाले छेद में है।',
  pegSolitaireSingleTitle: 'एक गोटी बची',
  pegSolitaireSingleBody: 'आख़िरी गोटी घेरे वाले छेद के बाहर है।',
  pegSolitaireStuckTitle: 'कोई छलांग नहीं बची',
  pegSolitaireStuckBody: 'अब कोई गोटी कूद नहीं सकती।',
  pegSolitairePegsLeftLabel: 'बची गोटियाँ',
  pegSolitaireFewestLabel: 'इस बोर्ड पर सबसे कम',
  pegSolitaireNewFewest: 'इस बोर्ड पर अब तक की सबसे कम।',
  pegSolitaireBoardFact: 'बोर्ड',
  pegSolitaireNewBoard: 'नया बोर्ड',

  pegSolitaireStatFewest: 'सबसे कम बची गोटियाँ',
  pegSolitaireStatPerfect: 'पूर्ण जीत',

  pegSolitaireStep1Title: 'कूदें और हटाएँ',
  pegSolitaireStep1Body:
    'गोटी को बगल वाली गोटी के ऊपर से खाली छेद में कुदाएँ — जिस गोटी के ऊपर से कूदी, वह हट जाती है।',
  pegSolitaireStep2Title: 'सिर्फ़ सीधी रेखा में',
  pegSolitaireStep2Body:
    'छलांग सीधी होती है: ब्रिटिश पर ऊपर, नीचे और अगल-बगल, त्रिकोण पर तीनों रेखाओं के साथ।',
  pegSolitaireStep3Title: 'आख़िरी गोटी बचाएँ',
  pegSolitaireStep3Body:
    'जब कोई गोटी कूद न सके, खेल ख़त्म — पूर्ण जीत के लिए आख़िरी गोटी घेरे वाले छेद में छोड़ें।',
};
