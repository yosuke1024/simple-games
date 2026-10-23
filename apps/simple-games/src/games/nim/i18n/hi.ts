/** AI-authored translation draft; no human review claimed. See docs/NIM_RULES.md. */
import type { NimMessages } from './en';
export const hi: NimMessages = {
  nimName: 'Nim',
  nimMode_easy: 'आसान',
  nimMode_normal: 'सामान्य',
  nimMode_hard: 'कठिन',
  nimRow: 'पंक्ति {row}: {count} पत्थर',
  nimTake: '{count} लें',
  nimYourTurn: 'आपकी बारी',
  nimCpuTurn: 'CPU की बारी',
  nimPaused: 'रुका हुआ है। तैयार होने पर जारी रखें।',
  nimLastMove: 'पिछली चाल: पंक्ति {row} से {count}।',
  nimGoal: 'जीतने के लिए आखिरी पत्थर लें।',
  nimChooseRow: 'एक पंक्ति चुनें।',
  nimChooseCount: 'लेने के लिए संख्या चुनें।',
  nimWon: 'आप जीत गए!',
  nimLost: 'CPU जीता',
  nimOpponent: 'प्रतिद्वंद्वी',
  nimWins: 'जीत',
  nimLosses: 'हार',
  nimStep1Title: 'एक पंक्ति चुनें',
  nimStep1Body: 'पत्थरों वाली एक पंक्ति चुनें; पहली बारी हमेशा आपकी है।',
  nimStep2Title: 'एक या अधिक लें',
  nimStep2Body: 'उस पंक्ति से हटाने वाले पत्थरों की संख्या चुनकर पुष्टि करें।',
  nimStep3Title: 'आखिरी पत्थर लें',
  nimStep3Body:
    'आप और CPU बारी-बारी से खेलते हैं; आखिरी पत्थर लेने वाला जीतता है। पूर्ववत आपकी पूरी बारी वापस लेता है।',
};
