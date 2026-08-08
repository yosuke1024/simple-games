import type { MahjongMessages } from './en';

export const hi: MahjongMessages = {
  mahjongName: 'Mahjong Solitaire',
  mahjongBoardLabel: 'माहजोंग बोर्ड, {n} टाइलें बाकी',
  mahjongTilesLeft: '{n} टाइलें बाकी',

  mahjongFaceCharacters: 'कैरेक्टर {n}',
  mahjongFaceDots: 'गोले {n}',
  mahjongFaceBamboo: 'बांस {n}',
  mahjongFaceEast: 'पूर्वी हवा',
  mahjongFaceSouth: 'दक्षिणी हवा',
  mahjongFaceWest: 'पश्चिमी हवा',
  mahjongFaceNorth: 'उत्तरी हवा',
  mahjongFaceDragonRed: 'लाल ड्रैगन',
  mahjongFaceDragonGreen: 'हरा ड्रैगन',
  mahjongFaceDragonWhite: 'सफ़ेद ड्रैगन',
  mahjongFaceFlower: 'फूल {n}',
  mahjongFaceSeason: 'ऋतु {n}',

  mahjongTileFree: '{tile}, उठाई जा सकती है',
  mahjongTileBlocked: '{tile}, रुकी हुई',
  mahjongTileSelected: '{tile}, चुनी गई',

  mahjongStuckTitle: 'कोई खुला जोड़ा नहीं',
  mahjongStuckBody:
    'कुछ चालें पूर्ववत करें या इसी बोर्ड को फिर से आज़माएँ — दोनों मुफ़्त और असीमित हैं।',

  mahjongHintNone: 'अभी कोई जोड़ा खुला नहीं है।',

  mahjongClearTitle: 'पूरा हुआ!',
  mahjongClearBody: 'सारी टाइलें बोर्ड से हट गईं।',
  mahjongHintsUsed: 'इस्तेमाल किए गए संकेत',
  mahjongNewBestTime: 'आपका सबसे तेज़ समय।',

  mahjongLevelsCleared: 'पूरे किए गए स्तर',
  mahjongDailiesCleared: 'पूरे किए गए दैनिक',
  mahjongDailyBacklogHint: 'पिछले सभी दिन खुले रहते हैं।',

  mahjongStep1Title: 'एक जैसे जोड़े उठाएँ',
  mahjongStep1Body:
    'एक जैसी दो टाइलों पर टैप करके उन्हें हटाएँ। टाइल तभी उठाई जा सकती है जब उसके ऊपर कुछ न हो और उसका बायाँ या दायाँ किनारा खुला हो।',
  mahjongStep2Title: 'फूल और ऋतुएँ समूह हैं',
  mahjongStep2Body: 'कोई भी फूल किसी भी फूल से, और कोई भी ऋतु किसी भी ऋतु से जुड़ती है।',
  mahjongStep3Title: 'बोर्ड खाली करें',
  mahjongStep3Body:
    'हर बोर्ड पूरा किया जा सकता है। जोड़े न बचें तो पूर्ववत करें या फिर से आज़माएँ — दोनों मुफ़्त और असीमित हैं।',
};
