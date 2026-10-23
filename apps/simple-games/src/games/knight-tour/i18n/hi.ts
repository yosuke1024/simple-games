/** AI-authored translation draft; no human review claimed. See docs/KNIGHT_TOUR_RULES.md. */
import type { KnightTourMessages } from './en';
export const hi: KnightTourMessages = {
  knightTourName: 'Knight’s Tour',
  knightTourVisited: 'देखे गए: {count} / {total}',
  knightTourBoard: 'बोर्ड',
  knightTourCurrent: 'घोड़ा, वर्तमान खाना',
  knightTourVisitNumber: 'यात्रा {count}',
  knightTourLegal: 'वैध गंतव्य',
  knightTourEmpty: 'अभी नहीं गए',
  knightTourCell: 'पंक्ति {row}, स्तंभ {col}: {content}',
  knightTourPaused: 'रुका हुआ है। तैयार होने पर जारी रखें।',
  knightTourStuck: 'कोई चाल नहीं बची। पूर्ववत करके दूसरा रास्ता आज़माएँ।',
  knightTourInstruction: 'L आकार में बिंदु वाले खाने पर जाएँ।',
  knightTourNewBoard: 'नया बोर्ड',
  knightTourWon: 'यात्रा पूरी!',
  knightTourWins: 'पूरे किए',
  knightTourStep1Title: 'L आकार में चलें',
  knightTourStep1Body:
    'घोड़ा एक दिशा में दो खाने और बगल में एक खाना चलता है; बिंदु वैध गंतव्य दिखाते हैं।',
  knightTourStep2Title: 'हर खाने पर एक बार जाएँ',
  knightTourStep2Body: 'हर पड़ाव पर संख्या जुड़ती है; किसी खाने पर दोबारा नहीं जा सकते।',
  knightTourStep3Title: 'अपनी गति से खोजें',
  knightTourStep3Body: 'सभी खानों पर जाकर पूरा करें। अटकने पर पूर्ववत करके दूसरा रास्ता आज़माएँ।',
};
