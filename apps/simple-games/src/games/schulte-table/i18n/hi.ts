import type { SchulteMessages } from './en';

export const hi: SchulteMessages = {
  schulteName: 'Schulte Table',

  schulteBoardLabel: 'संख्याओं का बोर्ड',
  schulteCell: '{value}, पंक्ति {row}, स्तंभ {col}',
  schulteCellDone: '{value}, पंक्ति {row}, स्तंभ {col}, टैप किया जा चुका',
  schulteFind: 'ढूँढें',

  schulteDoneTitle: 'सब मिल गए',
  schulteDoneBody: 'आपने हर संख्या को क्रम से टैप किया।',
  schulteMisses: 'गलत टैप',
  schulteNewBestTime: 'आपका सबसे तेज़ समय।',
  schulteConfirmRestartBody: 'यह दौर पहली संख्या से फिर शुरू होगा।',

  schulteDailyBacklogHint: 'पिछला हर दिन हमेशा खुला रहता है।',
  schulteSizeLabel: '{n}x{n}',
  schulteLevelsDone: 'पूरे किए लेवल',
  schulteDailiesDone: 'पूरी की गई डेली',
  schulteTotalMisses: 'कुल गलत टैप',

  schulteStep1Title: '1, फिर 2, फिर 3 पर टैप करें',
  schulteStep1Body: 'संख्याएँ बिखरी हुई हैं। उन्हें क्रम से टैप करें।',
  schulteStep2Title: 'ढूँढी जाने वाली संख्या बोर्ड के ऊपर है',
  schulteStep2Body: 'गलत टैप से कुछ नहीं बिगड़ता। बोर्ड बस इंतज़ार करता है।',
  schulteStep3Title: 'पूरा बोर्ड खत्म करें',
  schulteStep3Body: 'आपका समय दर्ज होता है। कोई समय सीमा नहीं है।',
};
