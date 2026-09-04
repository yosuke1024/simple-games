import type { Messages } from './en';

export const hi: Messages = {
  tagline: 'ऑफ़लाइन खेलें। कोई खाता नहीं। कोई पेवॉल नहीं।',

  resume: 'जारी रखें',
  dailyChallenge: 'डेली चैलेंज',
  dailyDoneBadge: 'आज पूरा हुआ',
  howToPlay: 'कैसे खेलें',
  statistics: 'आंकड़े',
  settings: 'सेटिंग्स',

  modeLevel: 'लेवल {n}',
  levelSelect: 'लेवल चुनें',
  levelLocked: 'लेवल {n}, लॉक है',
  nextLevel: 'अगला लेवल',
  levelsTitle: 'लेवल',
  reachedLevel: 'पहुँचा लेवल',

  score: 'स्कोर',

  dailyPast: 'पिछली डेली',
  dailyToday: 'आज',
  dailyBacklogHint: 'किसी दिन को पूरा करें, तो उससे पिछला दिन खुल जाता है।',
  modeDaily: 'डेली',
  // 'फ़्री' reads first as "free of charge" in Hindi, which this mode is not
  // about — every game feature is free with or without it. मुक्त खेल is the
  // unrestricted-play sense the mode actually has (docs/BRAND.md「表現ルール」:
  // never let a word claim the app is free without saying what is free).
  freePlay: 'मुक्त खेल',
  freePlayNote: 'जब चाहें, एक नया बोर्ड।',
  difficulty: 'कठिनाई',
  undo: 'अनडू',
  hint: 'संकेत',
  timeLabel: 'समय',
  movesLabel: 'चालें',

  tryAgain: 'वही बोर्ड फिर से',
  newGame: 'नया गेम',
  backHome: 'होम',

  confirmNewGameTitle: 'नया गेम शुरू करें?',
  confirmNewGameBody: 'अभी चल रहा गेम खो जाएगा।',
  cancel: 'रद्द करें',
  confirm: 'शुरू करें',

  startPlaying: 'खेलना शुरू करें',
  next: 'आगे',
  back: 'पीछे',
  close: 'बंद करें',

  language: 'भाषा',
  languageSystem: 'डिवाइस सेटिंग',
  theme: 'थीम',
  themeSystem: 'सिस्टम',
  themeLight: 'लाइट',
  themeDark: 'डार्क',
  sound: 'ध्वनि',
  vibration: 'कंपन',
  reducedMotion: 'कम एनिमेशन',
  privacyPolicy: 'गोपनीयता नीति',
  termsOfUse: 'उपयोग की शर्तें',
  adPrivacyOptions: 'विज्ञापन गोपनीयता विकल्प',
  resetData: 'लोकल डेटा हटाएँ',
  resetConfirmTitle: 'सभी लोकल डेटा हटाएँ?',
  resetConfirmBody: 'इस डिवाइस से गेम, आंकड़े और सेटिंग्स हट जाएँगी। इसे वापस नहीं किया जा सकता।',
  delete: 'हटाएँ',
  version: 'संस्करण',

  played: 'खेले गए गेम',
  cleared: 'जीते गए गेम',
  totalTime: 'कुल खेल समय',
  bestTime: 'सबसे तेज़ जीत',

  // Collection shell
  gamesHeading: 'गेम',
  recentHeading: 'हाल में खेले गए',
  favoritesHeading: 'पसंदीदा',
  addToFavorites: 'पसंदीदा में जोड़ें',
  removeFromFavorites: 'पसंदीदा से निकालें',
  categoryLogic: 'लॉजिक',
  categoryCards: 'ताश',
  categoryPuzzle: 'पहेली',
  categoryBoard: 'बोर्ड गेम',
  categoryArcade: 'आर्केड',
  categoryDrills: 'अभ्यास',
  backToGames: 'सभी गेम',
  gameLoading: 'लोड हो रहा है…',
  gameLoadFailed: 'गेम लोड नहीं हो सका।',
  gameLoadRetry: 'फिर से कोशिश करें',
  learnMore: 'और जानें',

  // About & open source
  aboutTitle: 'ऐप के बारे में',
  viewSource: 'सोर्स कोड देखें',
  reportBug: 'समस्या रिपोर्ट करें',
  suggestGame: 'गेम सुझाएँ',
  viewLicenses: 'लाइसेंस देखें',

  // Ads & support
  removeAdsTitle: 'विज्ञापन हटाएँ और Simple Games का समर्थन करें',
  adSupportBody:
    'Simple Games केवल ऑनलाइन होने पर ही एक छोटा बैनर विज्ञापन दिखाता है, जो मुझे ऐप को बनाए रखने और बेहतर बनाने में मदद करता है। विज्ञापन नहीं चाहिए? एक बार की खरीद से उन्हें हमेशा के लिए हटा सकते हैं।',
  removeAdsAction: 'विज्ञापन हटाएँ',
  restorePurchase: 'खरीद पुनर्स्थापित करें',
  purchaseThanks: 'बैनर विज्ञापन हटा दिए गए हैं। Simple Games का समर्थन करने के लिए धन्यवाद।',

  reviewPromptTitle: 'क्या आपको Simple Games पसंद आ रहा है?',
  reviewYes: 'हाँ, मज़ा आ रहा है',
  reviewNo: 'कुछ ख़ास नहीं',
  reviewLater: 'अभी नहीं',
  reviewFeedbackTitle: 'क्या बेहतर हो सकता है?',
  reviewFeedbackBody:
    'मुझे ईमेल से बताएँ — मैं हर संदेश पढ़ता हूँ। जब तक आप मेल ऐप में भेजें नहीं दबाते, कुछ भी नहीं भेजा जाता।',
  reviewFeedbackAction: 'ईमेल लिखें',

  // The browser version's one-time pointer at the app
  webAppPromptTitle: 'और भी शांति से खेलें — पहली बार खोलने से ही पूरी तरह ऑफ़लाइन।',
  webAppPromptBody: 'ऐप आपकी होम स्क्रीन से खुलता है और आपकी प्रगति आपके डिवाइस में सहेजता है।',

  // The optional share on a result screen. {game} is the registry title, a
  // proper noun that is not translated; `cleared` is only used for a real win.
  shareAction: 'साझा करें',
  shareCleared: 'मैंने Simple Games पर {game} पूरा किया।',
  sharePlayed: 'मैंने Simple Games पर {game} खेला।',
  shareInvite: 'इसे सीधे ब्राउज़र में खेला जा सकता है।',
  shareChallenge: 'क्या आप भी आज़माएँगे?',
  shareCardCleared: 'पूरा हुआ!',
  shareCopied: 'लिंक कॉपी हो गया',

  // ---- Arcade (Brick Breaker / Sky Fighter) ----
  livesLeft: 'जीवन: {n}',
  levelsCleared: 'पूरे किए स्तर',
};
