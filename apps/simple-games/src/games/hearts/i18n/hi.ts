import type { HeartsMessages } from './en';

export const hi: HeartsMessages = {
  heartsName: 'Hearts',

  heartsChooseOpponent: 'अपने प्रतिद्वंद्वी चुनें',
  heartsDifficulty_easy: 'आसान',
  heartsDifficulty_normal: 'सामान्य',
  heartsDifficulty_hard: 'कठिन',
  heartsRecordNote: '{wins} जीत · {losses} हार · {draws} बराबरी',
  heartsConfirmSwitchTitle: 'चालू मैच बदलें?',
  heartsConfirmSwitchBody: 'आपका {current} मैच नए {next} मैच से बदल जाएगा।',

  heartsTableLabel: 'Hearts की मेज़',
  heartsHandLabel: 'आपके पत्ते',
  heartsTrickLabel: 'मेज़ की चाल',
  heartsTrayLabel: 'जो पत्ते आप दे रहे हैं',
  heartsYou: 'आप',
  heartsCpuSeat: 'CPU {n}',
  heartsYouLabel: 'आप: इस दौर में {hand} अंक, मैच में {total}',
  heartsSeatLabel: 'CPU {n}: {cards} पत्ते, इस दौर में {hand} अंक, मैच में {total}',
  heartsTookLastTrick: 'पिछली चाल जीती',
  heartsCardLabel: '{suit} का {rank}',
  heartsSuit_spades: 'हुकुम',
  heartsSuit_hearts: 'पान',
  heartsSuit_diamonds: 'ईंट',
  heartsSuit_clubs: 'चिड़ी',
  heartsCardBlocked: '{card}, अभी नहीं चल सकते',
  heartsCardChosen: '{card}, देने के लिए चुना गया',
  heartsTrickCard: '{card}, {seat}',

  heartsPassPrompt: 'देने के लिए तीन पत्ते चुनें',
  heartsPassLeft: 'बाईं ओर दे रहे हैं',
  heartsPassAcross: 'सामने वाले को दे रहे हैं',
  heartsPassRight: 'दाईं ओर दे रहे हैं',
  heartsPassConfirm: 'ये तीन दें',
  heartsPassWaiting: 'बाकी खिलाड़ियों का इंतज़ार…',

  heartsPlayPrompt: 'पत्ते पर टैप करें, चलने के लिए फिर टैप करें',
  heartsCpuTurn: 'CPU {n} चल रहा है…',
  heartsTrickYou: 'यह चाल आपने जीती',
  heartsTrickCpu: 'यह चाल CPU {n} ने जीती',

  heartsHandTitle: 'दौर का हिसाब',
  heartsMoonTitle: 'पूरे छब्बीस',
  heartsMoonYou: 'आपने पूरे छब्बीस अंक ले लिए, इसलिए बाकी तीनों को 26-26 अंक मिलते हैं।',
  heartsMoonCpu: 'CPU {n} ने पूरे छब्बीस अंक ले लिए, इसलिए बाकी सबको 26 अंक मिलते हैं।',
  heartsThisHand: 'यह दौर',
  heartsMatchTotal: 'मैच',
  heartsNextHand: 'अगला दौर',

  heartsWinTitle: 'आप जीत गए!',
  heartsWinBody: 'जब कोई सौ अंक पार कर गया, तब सबसे कम अंक आपके थे।',
  heartsLoseTitle: 'CPU जीत गया',
  heartsLoseBody: 'किसी और खिलाड़ी के अंक आपसे कम रहे। अगला मैच मुफ़्त है।',
  heartsDrawTitle: 'बराबरी',
  heartsDrawBody: 'सबसे कम अंकों पर आप किसी और खिलाड़ी के बराबर रहे।',
  heartsFinalScores: 'आख़िरी अंक',

  heartsWins: 'जीत',
  heartsLosses: 'हार',
  heartsDraws: 'बराबरी',

  heartsStep1Title: 'तीन पत्ते दें',
  heartsStep1Body:
    'ज़्यादातर दौरों की शुरुआत में तीन पत्ते चुनकर आगे दिए जाते हैं — पहले बाएँ, फिर दाएँ, फिर सामने, और फिर एक दौर जिसमें कोई नहीं देता।',
  heartsStep2Title: 'सूट का साथ दें',
  heartsStep2Body:
    'पहला पत्ता जिस सूट का चला जाए, वही सूट आपके पास रहने तक चलना है, और उस सूट का सबसे बड़ा पत्ता चाल जीत लेता है।',
  heartsStep3Title: 'सबसे कम अंक जीतते हैं',
  heartsStep3Body:
    'आपके पास आया हर पान एक अंक का है और हुकुम की बेगम तेरह अंकों की, इसलिए जब कोई सौ अंक पार करे तब सबसे कम अंकों वाला जीतता है।',
};
