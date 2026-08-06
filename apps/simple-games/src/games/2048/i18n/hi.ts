import type { Game2048Messages } from './en';

export const hi: Game2048Messages = {
  mergeName: '2048',
  mergeBoardLabel: '2048 बोर्ड, 4 गुणा 4',
  mergeCell: 'पंक्ति {row}, स्तंभ {col}: {value}',
  mergeCellEmpty: 'पंक्ति {row}, स्तंभ {col}: खाली',
  mergeBestScore: 'सर्वश्रेष्ठ स्कोर',
  mergeBestTile: 'सबसे बड़ी टाइल',
  mergeReachedCount: '2048 तक कितनी बार पहुँचे',
  mergeReachedTitle: 'आप 2048 तक पहुँच गए!',
  mergeReachedBody: 'खेलते रहिए — बोर्ड अभी खुला है।',
  mergeKeepGoing: 'खेलते रहें',
  mergeOverTitle: 'कोई चाल बाकी नहीं',
  mergeOverBody: 'हर खाना भरा है और अब कुछ भी नहीं जुड़ सकता।',
  mergeNewBestScore: 'आपका अब तक का सर्वश्रेष्ठ स्कोर।',
  mergeStep1Title: 'सरकाने के लिए स्वाइप करें',
  mergeStep1Body: 'सारी टाइलें एक साथ उसी ओर सरकती हैं, और एक जैसे दो अंक मिलकर एक बन जाते हैं।',
  mergeStep2Title: 'एक नई टाइल आती है',
  mergeStep2Body: 'बोर्ड बदलने वाली हर चाल के बाद एक टाइल जुड़ जाती है।',
  mergeStep3Title: 'अटक गए? वापस लें',
  mergeStep3Body: 'अनडू मुफ़्त और असीमित है, और अभी मिली टाइल दोबारा नहीं निकाली जाती।',
};
