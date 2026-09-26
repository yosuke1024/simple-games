import type { DominoesMessages } from './en';

export const hi: DominoesMessages = {
  dominoesName: 'Dominoes',
  dominoesRecordNote: '{wins} जीत · {losses} हार',

  dominoesTileLabel: 'टाइल {a}–{b}',
  dominoesLineLabel: 'खेल की पंक्ति: {count} टाइलें, बायाँ छोर {left}, दायाँ छोर {right}',
  dominoesHandLabel: 'आपकी टाइलें',
  dominoesPlayLeft: 'बाएँ छोर पर रखें ({value})',
  dominoesPlayRight: 'दाएँ छोर पर रखें ({value})',
  dominoesCpuShort: 'CPU',
  dominoesBoneyardShort: 'गड्डी',
  dominoesCpuTiles: 'CPU के पास {count} टाइलें हैं',
  dominoesBoneyardTiles: 'गड्डी: {count} टाइलें',
  dominoesDraw: 'उठाएँ',
  dominoesPass: 'पास',

  dominoesYourTurn: 'आपकी बारी',
  dominoesCpuTurn: 'CPU सोच रहा है…',
  dominoesCpuDrew: 'CPU ने एक टाइल उठाई',
  dominoesCpuPassed: 'CPU ने पास किया। आपकी बारी',
  dominoesMustDraw: 'कोई टाइल फिट नहीं बैठती। गड्डी से उठाएँ',
  dominoesNoTileFits: 'कोई टाइल फिट नहीं बैठती और गड्डी खाली है। पास करें',
  dominoesChooseEnd: 'इस टाइल के लिए एक छोर चुनें',
  dominoesOpenedYou: 'आपने {tile} से शुरुआत की',
  dominoesOpenedCpu: 'CPU ने {tile} से शुरुआत की। आपकी बारी',

  dominoesWinTitle: 'आप जीत गए!',
  dominoesWinBodyOut: 'आपने अपनी आखिरी टाइल रख दी।',
  dominoesWinBodyBlocked: 'कोई नहीं रख सका, और आपके अंक कम रहे।',
  dominoesLoseTitle: 'CPU जीत गया',
  dominoesLoseBodyOut: 'CPU ने अपनी आखिरी टाइल रख दी।',
  dominoesLoseBodyBlocked: 'कोई नहीं रख सका, और CPU के अंक कम रहे।',
  dominoesDrawTitle: 'बराबरी',
  dominoesDrawBody: 'कोई नहीं रख सका, और अंक बराबर रहे।',
  dominoesScoreYou: 'आपको {points} अंक मिले',
  dominoesScoreCpu: 'CPU को {points} अंक मिले',
  dominoesPipsLeft: 'बचे हुए अंक: आप {you}, CPU {cpu}',

  dominoesWins: 'जीत',
  dominoesLosses: 'हार',
  dominoesDraws: 'बराबरी',

  dominoesStep1Title: 'किसी छोर से मिलाएँ',
  dominoesStep1Body: 'ऐसी टाइल रखें जिसका अंक पंक्ति के किसी खुले छोर से मेल खाता हो।',
  dominoesStep2Title: 'फँस गए? उठाएँ',
  dominoesStep2Body:
    'अगर कोई टाइल फिट न बैठे, तो जब तक फिट न बैठे तब तक गड्डी से उठाएँ। गड्डी खाली होने पर ही पास करें।',
  dominoesStep3Title: 'पहले खत्म करें',
  dominoesStep3Body:
    'जीतने के लिए अपनी आखिरी टाइल रखें। दूसरे हाथ में बचे अंकों का जोड़ आपका स्कोर है।',
};
