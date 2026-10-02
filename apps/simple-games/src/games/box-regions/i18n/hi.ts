/**
 * Hindi catalog for Box Regions — machine translation of the English
 * source, unreviewed (docs/I18N_POLICY.md: provenance `machine`). The title
 * (`boxRegionsName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source.
 */
import type { BoxRegionsMessages } from './en';

export const hi: BoxRegionsMessages = {
  boxRegionsName: 'Box Regions',
  boxRegionsChooseBoard: 'बोर्ड चुनें',
  boxRegionsDifficulty_easy: 'आसान',
  boxRegionsDifficulty_medium: 'मध्यम',
  boxRegionsDifficulty_hard: 'कठिन',
  boxRegionsBoardNote: '{width}×{height}',
  boxRegionsConfirmSwitchTitle: 'चालू बोर्ड बदलें?',
  boxRegionsConfirmSwitchBody: 'आपका {current} गेम नए {next} बोर्ड से बदल दिया जाएगा।',
  boxRegionsBoardLabel: 'Box Regions बोर्ड, {width} गुणा {height}',
  boxRegionsCellAssigned: 'पंक्ति {row}, स्तंभ {col}, बॉक्स {region}',
  boxRegionsCellEmpty: 'पंक्ति {row}, स्तंभ {col}, किसी बॉक्स में नहीं',
  boxRegionsClueCount: '{size} में से {count} खाने',
  boxRegionsRuleBroken: 'नियम टूट रहा है',
  boxRegionsKind_square: 'वर्ग',
  boxRegionsKind_tall: 'लंबा',
  boxRegionsKind_wide: 'चौड़ा',
  boxRegionsKind_free: 'कोई भी बॉक्स',
  boxRegionsHintWrong: 'हाइलाइट किया गया बॉक्स उत्तर से मेल नहीं खाता।',
  boxRegionsHintForced: 'चिह्नित खाना केवल हाइलाइट किए गए सुराग़ के बॉक्स का हो सकता है।',
  boxRegionsHintSole: 'इस बॉक्स को केवल एक ही तरह से बनाया जा सकता है।',
  boxRegionsHintCommon: 'इस सुराग़ का बॉक्स चाहे जैसे बने, चिह्नित खाने उसमें आएँगे।',
  boxRegionsHintNone: 'अभी कोई निश्चित चाल नहीं मिली।',
  boxRegionsSolvedTitle: 'हल हो गया!',
  boxRegionsSolvedBody: 'हर खाना अपने बॉक्स में है।',
  boxRegionsHintsUsed: 'इस्तेमाल किए गए संकेत',
  boxRegionsNewBestTime: 'अब तक का सबसे तेज़।',
  boxRegionsNewBoard: 'नया बोर्ड',
  boxRegionsSolvedCount: 'हल की गई पहेलियाँ',
  boxRegionsDailySection: 'दैनिक',
  boxRegionsDailiesCleared: 'पूरे किए गए दिन',
  boxRegionsStep1Title: 'बॉक्स में बाँटें',
  boxRegionsStep1Body: 'बोर्ड को आयतों में बाँटें, हर आयत में ठीक एक सुराग़ हो।',
  boxRegionsStep2Title: 'सुराग़ पढ़ें',
  boxRegionsStep2Body:
    'संख्या बताती है कि बॉक्स में कितने खाने हैं; चिह्न बताता है कि वर्ग, लंबा, चौड़ा या कोई भी।',
  boxRegionsStep3Title: 'कोने से कोने तक खींचें',
  boxRegionsStep3Body:
    'बॉक्स बनाने के लिए एक कोने से दूसरे कोने तक खींचें। बॉक्स हटाने के लिए उस पर टैप करें। अटक गए? संकेत आज़माएँ।',
};
