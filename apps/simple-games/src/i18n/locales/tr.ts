import type { Messages } from './en';

export const tr: Messages = {
  tagline: 'Çevrimdışı çalışır. Hesap yok. Ödeme duvarı yok.',

  resume: 'Devam et',
  dailyChallenge: 'Günlük Bulmaca',
  dailyDoneBadge: 'Bugün tamamlandı',
  howToPlay: 'Nasıl Oynanır',
  statistics: 'İstatistik',
  settings: 'Ayarlar',

  modeLevel: 'Seviye {n}',
  levelSelect: 'Seviye Seç',
  levelLocked: 'Seviye {n}, kilitli',
  nextLevel: 'Sonraki Seviye',
  levelsTitle: 'Seviyeler',
  reachedLevel: 'Ulaşılan seviye',

  score: 'Puan',

  dailyPast: 'Geçmiş Günler',
  dailyToday: 'Bugün',
  dailyBacklogHint: 'Bir günü bitir, bir önceki gün açılsın.',
  modeDaily: 'Günlük',
  freePlay: 'Serbest Oyun',
  freePlayNote: 'İstediğin zaman yeni bir tahta.',
  difficulty: 'Zorluk',
  undo: 'Geri al',
  hint: 'İpucu',
  timeLabel: 'Süre',
  movesLabel: 'Hamle',

  tryAgain: 'Aynı tahtayı tekrarla',
  newGame: 'Yeni oyun',
  backHome: 'Ana sayfa',

  confirmNewGameTitle: 'Yeni oyun başlasın mı?',
  confirmNewGameBody: 'Devam eden oyunun kaybolacak.',
  cancel: 'Vazgeç',
  confirm: 'Başlat',

  startPlaying: 'Oynamaya Başla',
  next: 'İleri',
  back: 'Geri',
  close: 'Kapat',

  language: 'Dil',
  languageSystem: 'Sistem',
  theme: 'Tema',
  themeSystem: 'Sistem',
  themeLight: 'Açık',
  themeDark: 'Koyu',
  sound: 'Ses',
  vibration: 'Titreşim',
  reducedMotion: 'Hareketi azalt',
  privacyPolicy: 'Gizlilik Politikası',
  termsOfUse: 'Kullanım Koşulları',
  adPrivacyOptions: 'Reklam gizlilik seçenekleri',
  // Backup & Restore (issue #160). One file the player moves themselves —
  // Simple Games has no account, no cloud save, and nothing that uploads it.
  backupTitle: 'Yedekleme ve Geri Yükleme',
  backupBody: 'İlerlemeni başka bir cihaza taşı ya da bir kopyasını sakla.',
  backupPrivacyNote:
    'Yedek, cihazındaki şifrelenmemiş bir dosyadır. Simple Games onu hiçbir yere yüklemez; nereye koyacağına yalnızca sen karar verirsin.',
  backupPurchaseNote:
    'Reklam kaldırma satın alımı yedeğe dahil değildir. Onu mağazadan geri yükle.',
  backupExport: 'Yedeği Dışa Aktar',
  backupRestore: 'Yedekten Geri Yükle',
  backupExportFailed: 'Yedek dosyası oluşturulamadı.',
  backupRestoreConfirmTitle: 'Bu cihazdaki veriler değiştirilsin mi?',
  backupRestoreConfirmBody:
    'Burada kayıtlı olan her şey — yarım kalan oyunlar, istatistikler ve ayarlar — {date} tarihli yedekle değiştirilir. Bu işlem geri alınamaz.',
  backupRestoreDone: 'Verilerin geri yüklendi.',
  backupRestoreFailed: 'Geri yükleme tamamlanamadı. Mevcut verilerin korundu.',
  backupFileUnreadable: 'Bu dosya bir Simple Games yedeği değil.',
  backupFileDamaged: 'Bu yedek dosyası bozuk. Hiçbir şey değiştirilmedi.',
  backupFileNewer:
    'Bu yedek, Simple Games’in daha yeni bir sürümüyle oluşturulmuş. Uygulamayı güncelleyip tekrar dene.',
  resetData: 'Yerel Verileri Sil',
  resetConfirmTitle: 'Tüm yerel veriler silinsin mi?',
  resetConfirmBody:
    'Bu işlem oyununu, istatistiklerini ve ayarlarını bu cihazdan kaldırır. Geri alınamaz.',
  delete: 'Sil',
  version: 'Sürüm',

  played: 'Oynanan oyun',
  cleared: 'Tamamlanan oyun',
  totalTime: 'Toplam oyun süresi',
  bestTime: 'En hızlı tamamlama',

  // Collection shell
  gamesHeading: 'Oyunlar',
  recentHeading: 'Son oynananlar',
  favoritesHeading: 'Favoriler',
  addToFavorites: 'Favorilere ekle',
  removeFromFavorites: 'Favorilerden çıkar',
  addToHomeScreen: 'Ana ekrana ekle',
  searchGames: 'Oyun ara',
  searchNoResults: 'Eşleşen oyun yok.',
  categoryLogic: 'Mantık',
  categoryCards: 'Kart oyunları',
  categoryPuzzle: 'Bulmaca',
  categoryBoard: 'Masa oyunları',
  categoryArcade: 'Arcade',
  categoryDrills: 'Alıştırmalar',
  backToGames: 'Tüm oyunlar',
  gameLoading: 'Yükleniyor…',
  gameLoadFailed: 'Oyun yüklenemedi.',
  gameLoadRetry: 'Tekrar dene',
  learnMore: 'Daha Fazla',

  // About & open source
  aboutTitle: 'Hakkında',
  viewSource: 'Kaynak Kodu Görüntüle',
  reportBug: 'Hata Bildir',
  suggestGame: 'Oyun Öner',
  viewLicenses: 'Lisansları Görüntüle',

  // Ads & support
  removeAdsTitle: "Reklamları Kaldır ve Simple Games'e Destek Ol",
  adSupportBody:
    'Simple Games, çevrimiçiyken gösterilen küçük bir banner reklamla desteklenir. Bu, uygulamayı sürdürmeme ve geliştirmeme yardımcı olur. Reklam istemiyor musun? Tek seferlik bir satın alma reklamları kalıcı olarak kaldırır.',
  removeAdsAction: 'Reklamları Kaldır',
  restorePurchase: 'Satın Almayı Geri Yükle',
  purchaseThanks: "Banner reklamlar kaldırıldı. Simple Games'e destek olduğun için teşekkürler.",

  reviewPromptTitle: 'Simple Games hoşuna gidiyor mu?',
  reviewYes: 'Evet, seviyorum',
  reviewNo: 'Pek değil',
  reviewLater: 'Şimdi değil',
  reviewFeedbackTitle: 'Neyi daha iyi yapabiliriz?',
  reviewFeedbackBody:
    'Bana e-postayla anlat — her mesajı okuyorum. Posta uygulamanda gönder düğmesine basana kadar hiçbir şey gönderilmez.',
  reviewFeedbackAction: 'E-posta yaz',

  // The browser version's one-time pointer at the app
  webAppPromptTitle: 'Daha sakin bir oyun, ilk açılıştan itibaren tamamen çevrimdışı.',
  webAppPromptBody: 'Uygulama ana ekranınızdan açılır ve ilerlemenizi cihazınızda saklar.',

  // The optional share on a result screen. {game} is the registry title, a
  // proper noun that is not translated; `cleared` is only used for a real win.
  shareAction: 'Paylaş',
  shareCleared: 'Simple Games’te {game} oyununu bitirdim.',
  sharePlayed: 'Simple Games’te {game} oynadım.',
  shareInvite: 'Doğrudan tarayıcıda oynayabilirsin.',
  shareChallenge: 'Sen de dener misin?',
  shareCardCleared: 'Tamamlandı!',
  shareCopied: 'Bağlantı kopyalandı',

  // ---- Arcade (Brick Breaker / Sky Fighter) ----
  livesLeft: 'Can: {n}',
  levelsCleared: 'Tamamlanan seviye',
};
