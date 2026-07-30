import type { Messages } from './en';

export const de: Messages = {
  numberMatchName: 'Number Match',
  tagline: 'Offline spielbar. Kein Konto. Keine Paywall.',

  resume: 'Weiter',
  dailyChallenge: 'Tagesrätsel',
  dailyDoneBadge: 'Heute geschafft',
  howToPlay: 'Anleitung',
  statistics: 'Statistik',
  settings: 'Einstellungen',

  modeLevel: 'Level {n}',
  levelSelect: 'Level wählen',
  levelLocked: 'Level {n}, gesperrt',
  nextLevel: 'Nächstes Level',
  levelsTitle: 'Level',
  reachedLevel: 'Erreichtes Level',

  score: 'Punkte',
  best: 'Rekord',
  newBest: 'Neuer Rekord!',
  scoreMatches: 'Paare',
  scoreRows: 'Reihenbonus',
  scoreClearBonus: 'Abräumbonus',
  scoreNoHint: 'Bonus ohne Tipp',
  bestScores: 'Bestwerte',
  totalBest: 'Summe aller Bestwerte',

  dailyPast: 'Frühere Tage',
  dailyToday: 'Heute',
  dailyBacklogHint: 'Schaffe einen Tag, um den davor freizuschalten.',
  modeDaily: 'Täglich',
  undo: 'Rückgängig',
  hint: 'Tipp',
  addNumbers: 'Nachlegen',
  timeLabel: 'Zeit',
  movesLabel: 'Züge',
  boardLabel: 'Spielfeld',
  cellLabel: '{value}, Zeile {row}, Spalte {col}',
  cellLabelStone: 'Stein, Zeile {row}, Spalte {col}',
  cellLabelWild: 'Joker, Zeile {row}, Spalte {col}',
  hintNoneToast: 'Keine Paare möglich — nutze Nachlegen.',
  wildIntroToast: 'Das Feld ✦ passt zu jeder Zahl.',
  stoneIntroToast: 'Steine lassen sich nicht paaren und blockieren den Weg.',

  clearTitle: 'Feld geräumt!',
  clearBody: 'Du hast alle Zahlen entfernt.',
  gameOverTitle: 'Keine Züge mehr',
  gameOverBody: 'Das Spielfeld ist am Limit.',
  tryAgain: 'Feld wiederholen',
  backHome: 'Start',

  confirmNewGameTitle: 'Neues Spiel starten?',
  confirmNewGameBody: 'Dein aktuelles Spiel geht verloren.',
  cancel: 'Abbrechen',
  confirm: 'Starten',

  step1Title: 'Gleich oder zusammen 10',
  step1Body: 'Verbinde zwei gleiche Zahlen oder zwei, die zusammen 10 ergeben.',
  step2Title: 'Der Weg muss frei sein',
  step2Body:
    'Waagerecht, senkrecht, diagonal — oder vom Zeilenende zum Anfang der nächsten Zeile. Leere Felder stören nicht, eine verbliebene Zahl blockiert den Weg.',
  step3Title: 'Leere das Feld',
  step3Body:
    'Steckst du fest? Mit Nachlegen kommen die restlichen Zahlen dazu. Rückgängig und Tipps sind immer gratis.',
  startPlaying: 'Jetzt spielen',
  next: 'Weiter',
  back: 'Zurück',
  close: 'Schließen',

  language: 'Sprache',
  languageSystem: 'System',
  theme: 'Design',
  themeSystem: 'System',
  themeLight: 'Hell',
  themeDark: 'Dunkel',
  sound: 'Ton',
  vibration: 'Vibration',
  reducedMotion: 'Bewegung reduzieren',
  privacyPolicy: 'Datenschutz',
  resetData: 'Lokale Daten löschen',
  resetConfirmTitle: 'Alle lokalen Daten löschen?',
  resetConfirmBody:
    'Spielstand, Statistik und Einstellungen werden von diesem Gerät entfernt. Das lässt sich nicht rückgängig machen.',
  delete: 'Löschen',
  version: 'Version',

  privacy1:
    'Kein Konto. Keine Anmeldung. Wir erfassen weder Name, E-Mail, Kontakte noch Standort.',
  privacy2:
    'Spielstand, Statistik und Einstellungen werden nur auf diesem Gerät gespeichert. Wir betreiben keine Server, und es gibt keine Cloud-Synchronisierung.',
  privacy3:
    'Online können Anzeigen von Google AdMob erscheinen; Google kann dabei Werbe-IDs des Geräts so verarbeiten, wie es die eigene Datenschutzerklärung beschreibt. Offline werden keine Anzeigen gezeigt und keine Anzeigen angefordert.',
  privacy4:
    'Beim Löschen der App oder über „Lokale Daten löschen“ werden deine Daten entfernt.',

  played: 'Gespielte Spiele',
  cleared: 'Geschaffte Spiele',
  gameOverCount: 'Verlorene Spiele',
  totalTime: 'Gesamte Spielzeit',
  bestTime: 'Bestzeit',

  // Collection shell
  collectionTagline: 'Ganz gratis. Ganz offline. Einfach spielen.',
  gamesHeading: 'Spiele',
  numberMatchBlurb: 'Zahlen paaren, die gleich sind oder zusammen 10 ergeben.',
  backToGames: 'Alle Spiele',
  learnMore: 'Mehr erfahren',

  // About & open source
  aboutTitle: 'Über die App',
  viewSource: 'Quellcode ansehen',
  reportBug: 'Fehler melden',
  suggestGame: 'Spiel vorschlagen',
  viewLicenses: 'Lizenzen ansehen',

  // Ads & support
  removeAdsTitle: 'Werbung entfernen & Simple Games unterstützen',
  adSupportBody:
    'Simple Games finanziert sich online über ein kleines Banner. Das hilft uns, die App zu pflegen und zu verbessern. Lieber ohne Werbung? Ein einmaliger Kauf entfernt sie dauerhaft.',
  removeAdsAction: 'Werbung entfernen',
  restorePurchase: 'Kauf wiederherstellen',
  purchaseThanks: 'Bannerwerbung ist entfernt. Danke, dass du Simple Games unterstützt.',

  reviewPromptTitle: 'Gefällt dir Simple Games?',
  reviewYes: 'Ja, es gefällt mir',
  reviewNo: 'Nicht so richtig',
  reviewLater: 'Jetzt nicht',
  reviewFeedbackTitle: 'Was könnte besser sein?',
  reviewFeedbackBody:
    'Schreib uns eine E-Mail — wir lesen jede Nachricht. Es wird nichts gesendet, bis du in deiner Mail-App auf Senden tippst.',
  reviewFeedbackAction: 'E-Mail schreiben',
  privacy5:
    'Ein optionaler einmaliger Kauf kann die Bannerwerbung entfernen. Der Kauf wird von Google Play abgewickelt; wir erhalten und speichern niemals Zahlungsdaten.',

  // Sudoku
  sudokuName: 'Sudoku',
  sudokuBlurb: 'Jede Zeile, Spalte und Box mit 1-9 füllen.',
  sudokuGridLabel: 'Sudoku-Gitter',
  sudokuPadLabel: 'Zahlenfeld',
  sudokuPadKey: '{value}, noch {n}',
  sudokuPadNoteKey: 'Notiz {value}',
  sudokuCellEmpty: 'Leer, Zeile {row}, Spalte {col}',
  sudokuCellGiven: '{value}, vorgegeben, Zeile {row}, Spalte {col}',
  sudokuCellEntry: '{value}, Zeile {row}, Spalte {col}',
  sudokuErase: 'Löschen',
  sudokuNotes: 'Notizen',
  sudokuMistakes: 'Fehler',
  sudokuTier_easy: 'Leicht',
  sudokuTier_medium: 'Mittel',
  sudokuTier_hard: 'Schwer',
  sudokuSolvedTitle: 'Gelöst!',
  sudokuSolvedBody: 'Jede Zeile, Spalte und Box enthält 1-9.',
  sudokuNewBestTime: 'Deine bisher schnellste Zeit.',
  sudokuLevelsSolved: 'Gelöste Level',
  sudokuDailiesSolved: 'Gelöste Tagesrätsel',
  sudokuAverageTime: 'Durchschnittszeit',
  sudokuHighlightMistakes: 'Fehler anzeigen',
  sudokuHighlightMistakesNote: 'Markiert Ziffern, die nicht zur Lösung passen. Doppelte werden immer markiert.',
  sudokuHintNone: 'Hier lässt sich noch nichts folgern.',
  sudokuHintOnlyDigit: 'In dieses Feld passt nur eine Ziffer.',
  sudokuHintOnlyCell: 'Nur hier kann {value} stehen.',
  sudokuHintLockedLine: 'In dieser Box passt {value} nur in die markierte Linie.',
  sudokuHintLockedBox: 'In dieser Linie passt {value} nur in die markierte Box.',
  sudokuHintRuledOut: 'Diese Felder schließen die Ziffern anderswo in der Einheit aus.',
  sudokuStep1Title: '1-9, je einmal',
  sudokuStep1Body: 'Jede Zeile, Spalte und 3x3-Box enthält 1 bis 9 genau einmal.',
  sudokuStep2Title: 'Notiere, was passt',
  sudokuStep2Body: 'Tippe auf Notizen, um Kandidaten einzutragen, während du ein Feld eingrenzt.',
  sudokuStep3Title: 'Fest? Hol dir einen Tipp',
  sudokuStep3Body: 'Ein Tipp zeigt, welches Feld feststeht und warum. Tipps und Rückgängig sind immer gratis.',

  // ---- Sliding Puzzle ----
  slideName: 'Schiebepuzzle',
  slideBlurb: 'Schiebe die Zahlen in die richtige Reihenfolge.',

  slideBoardLabel: 'Schiebepuzzle-Feld',
  slideTileLabel: '{value}, Zeile {row}, Spalte {col}',
  slideBlankLabel: 'Leer, Zeile {row}, Spalte {col}',
  slideSizeLabel: '{n}x{n}',

  slideMoves: 'Züge',
  slideBestMoves: 'Wenigste Züge',

  slideSolvedTitle: 'Gelöst!',
  slideSolvedBody: 'Alle Zahlen stehen wieder in der Reihenfolge.',
  slideNewBestMoves: 'So wenige Züge wie nie.',
  slideNewBestTime: 'Deine bisher schnellste Zeit.',

  slideLevelsSolved: 'Gelöste Level',
  slideDailiesSolved: 'Gelöste Tagesrätsel',
  slideDailyBacklogHint: 'Jeder frühere Tag bleibt offen.',

  slideStep1Title: 'Tippe neben die Lücke',
  slideStep1Body: 'Tippe auf ein Feld neben der Lücke, und es rutscht hinein.',
  slideStep2Title: 'Eine ganze Reihe rutscht',
  slideStep2Body: 'In derselben Zeile oder Spalte rutschen alle Felder dazwischen mit.',
  slideStep3Title: 'Von 1 bis zum Ende ordnen',
  slideStep3Body: 'Ordne die Zahlen in Leserichtung, die Lücke bleibt unten rechts.',

  // ---- Nonogram ----
  nonoName: 'Nonogramm',
  nonoBlurb: 'Male die Felder aus, die die Zahlen beschreiben.',

  nonoBoardLabel: 'Nonogramm-Feld, {size} mal {size}',
  nonoCellBlank: 'Leer, Zeile {row}, Spalte {col}',
  nonoCellFilled: 'Ausgemalt, Zeile {row}, Spalte {col}',
  nonoCellCrossed: 'Mit × markiert, Zeile {row}, Spalte {col}',
  nonoRowClueLabel: 'Zeile {n}: {clue}',
  nonoColClueLabel: 'Spalte {n}: {clue}',
  nonoSizeLabel: '{n}×{n}',

  nonoXMode: 'X-Modus',
  nonoXModeNote: 'Tippen setzt ein ×, langes Drücken malt aus.',
  nonoHintFound: 'Die hervorgehobene Linie legt ein Feld fest.',
  nonoHintBroken: 'Die hervorgehobene Linie passt nicht mehr zu ihrer Zahl.',
  nonoHintNone: 'Gerade ist kein sicherer Zug zu finden.',

  nonoSolvedTitle: 'Gelöst!',
  nonoSolvedBody: 'Alle Zahlen stimmen.',
  nonoHintsUsed: 'Verwendete Hinweise',
  nonoNewBestTime: 'Deine schnellste Zeit.',

  nonoLevelsSolved: 'Gelöste Level',
  nonoDailiesSolved: 'Gelöste Tagesrätsel',
  nonoDailyBacklogHint: 'Jeder frühere Tag bleibt offen.',

  nonoStep1Title: 'Zahlen sind Blöcke',
  nonoStep1Body: 'Jede Zahl steht für einen Block ausgemalter Felder in Reihenfolge, mit mindestens einer Lücke dazwischen.',
  nonoStep2Title: 'Unmögliches ausschließen',
  nonoStep2Body: 'Markiere Felder, die leer bleiben, mit einem ×, um die Linie einzugrenzen.',
  nonoStep3Title: 'Jede Linie erfüllen',
  nonoStep3Body: 'Stimmen alle Zeilen und Spalten, ist das Bild fertig. Raten ist nie nötig.',

  // ---- Minesweeper ----
  minesName: 'Minensucher',
  minesBlurb: 'Öffne jedes Feld ohne Mine.',

  // Home
  minesChooseBoard: 'Feld wählen',
  minesDifficulty_easy: 'Leicht',
  minesDifficulty_medium: 'Mittel',
  minesDifficulty_hard: 'Schwer',
  minesBoardNote: '{width}×{height} · {mines} Minen',
  minesConfirmSwitchTitle: 'Laufendes Feld ersetzen?',
  minesConfirmSwitchBody: 'Dein Spiel {current} wird durch ein neues Feld {next} ersetzt.',

  // Board
  minesBoardLabel: 'Minenfeld, {width} Spalten mal {height} Zeilen',
  minesCellHidden: 'Verdeckt, Zeile {row}, Spalte {col}',
  minesCellFlagged: 'Flagge, Zeile {row}, Spalte {col}',
  minesCellEmpty: 'Leer, Zeile {row}, Spalte {col}',
  minesCellNumber: '{count} Minen benachbart, Zeile {row}, Spalte {col}',
  minesCellMine: 'Mine, Zeile {row}, Spalte {col}',
  minesMinesLeft: 'Minen übrig',
  minesTapToStart: 'Tippe auf ein beliebiges Feld. Der erste Zug ist immer sicher.',

  // Actions
  minesFlagMode: 'Flaggenmodus',
  minesFlagModeNote: 'Tippen setzt eine Flagge, langes Drücken öffnet.',
  minesHintFound: 'Dieses Feld ist sicher — die markierten Zahlen zeigen warum.',
  minesHintNone: 'Hier lässt sich noch nichts folgern.',
  minesNewBoard: 'Neues Feld',

  // Result
  minesWonTitle: 'Geschafft!',
  minesWonBody: 'Alle Felder ohne Mine sind offen.',
  minesLostTitle: 'Mine geöffnet',
  minesLostBody: 'Dieses Spiel endet hier. Das gleiche Feld wartet, wann immer du willst.',
  minesNewBestTime: 'Deine bisher schnellste Zeit.',
  minesHintsUsed: 'Tipps',

  // Statistics
  minesGamesWon: 'Gewonnene Spiele',
  minesWinRate: 'Siegquote',
  minesDailySection: 'Täglich',
  minesDailiesCleared: 'Geschaffte Tage',

  // Quick Rules
  minesStep1Title: 'Zahlen zählen Minen',
  minesStep1Body: 'Sie sagt, wie viele der acht Nachbarfelder eine Mine enthalten.',
  minesStep2Title: 'Markiere, was sicher ist',
  minesStep2Body: 'Langes Drücken setzt eine Flagge. Im Flaggenmodus genügt ein Tippen.',
  minesStep3Title: 'Öffne den Rest zum Sieg',
  minesStep3Body: 'Der erste Zug ist immer sicher, und kein Feld verlangt Raten.',
};
