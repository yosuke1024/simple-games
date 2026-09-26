/**
 * Hindi catalog for Shape Regions (docs/I18N_POLICY.md: provenance
 * `machine`). The title (`shapeRegionsName`) is a proper noun and stays
 * as-is in every locale; placeholder names match the English source.
 */
import type { ShapeRegionsMessages } from './en';

export const hi: ShapeRegionsMessages = {
  shapeRegionsName: 'Shape Regions',
  shapeRegionsChooseBoard: 'बोर्ड चुनें',
  shapeRegionsDifficulty_easy: 'आसान',
  shapeRegionsDifficulty_medium: 'मध्यम',
  shapeRegionsDifficulty_hard: 'कठिन',
  shapeRegionsBoardNote: '{width}×{height}',
  shapeRegionsConfirmSwitchTitle: 'चल रहा बोर्ड बदलें?',
  shapeRegionsConfirmSwitchBody: 'आपका {current} खेल एक नए {next} बोर्ड से बदल जाएगा।',
  shapeRegionsBoardLabel: 'Shape Regions बोर्ड, {width} गुणा {height}',
  shapeRegionsCellAssigned: 'पंक्ति {row}, स्तंभ {col}, आकृति {region}',
  shapeRegionsCellEmpty: 'पंक्ति {row}, स्तंभ {col}, खाली',
  shapeRegionsClueCount: '{size} में से {count} खाने',
  shapeRegionsRuleBroken: 'नियम टूटा',
  shapeRegionsShape_line: 'रेखा',
  shapeRegionsShape_block: 'आयत',
  shapeRegionsShape_corner: 'कोना',
  shapeRegionsShape_tee: 'T आकृति',
  shapeRegionsShape_step: 'सीढ़ी',
  shapeRegionsHintWrong: 'हाइलाइट की गई आकृति उत्तर से मेल नहीं खाती।',
  shapeRegionsHintForced: 'चिह्नित खाना केवल हाइलाइट की गई आकृति का हो सकता है।',
  shapeRegionsHintSole: 'हाइलाइट की गई आकृति के बैठने का केवल एक तरीका है।',
  shapeRegionsHintCommon: 'हाइलाइट की गई आकृति जैसे भी बैठे, चिह्नित खाने उसमें आते हैं।',
  shapeRegionsHintNone: 'अभी कोई निश्चित चाल नहीं मिली।',
  shapeRegionsSolvedTitle: 'हल हो गया!',
  shapeRegionsSolvedBody: 'हर खाना अपनी आकृति में है।',
  shapeRegionsHintsUsed: 'संकेत उपयोग',
  shapeRegionsNewBestTime: 'अब तक का सबसे तेज़।',
  shapeRegionsNewBoard: 'नया बोर्ड',
  shapeRegionsSolvedCount: 'हल की गई पहेलियाँ',
  shapeRegionsDailySection: 'दैनिक',
  shapeRegionsDailiesCleared: 'पूरे किए दिन',
  shapeRegionsDailyBacklogHint: 'हर पिछला दिन खुला रहता है।',
  shapeRegionsStep1Title: 'संख्या और प्रतीक',
  shapeRegionsStep1Body: 'संख्या बताती है आकृति में कितने खाने हैं; प्रतीक उसका रूप है।',
  shapeRegionsStep2Title: 'संकेत से बढ़ाएँ',
  shapeRegionsStep2Body: 'संकेत से पड़ोसी खानों पर खींचकर आकृति बढ़ाएँ।',
  shapeRegionsStep3Title: 'बोर्ड भरें',
  shapeRegionsStep3Body:
    'पूरा होने पर हर खाना किसी आकृति का होता है। हटाने के लिए खाने पर टैप करें।',
};
