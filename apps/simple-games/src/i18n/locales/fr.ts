import type { Messages } from './en';

export const fr: Messages = {
  numberMatchName: 'Number Match',
  tagline: 'Fonctionne hors ligne. Sans compte. Sans paywall.',

  resume: 'Reprendre',
  dailyChallenge: 'Défi du jour',
  dailyDoneBadge: "Terminé aujourd'hui",
  howToPlay: 'Comment jouer',
  statistics: 'Statistiques',
  settings: 'Paramètres',

  modeLevel: 'Niveau {n}',
  levelSelect: 'Choisir un niveau',
  levelLocked: 'Niveau {n}, verrouillé',
  nextLevel: 'Niveau suivant',
  levelsTitle: 'Niveaux',
  reachedLevel: 'Niveau atteint',

  score: 'Score',
  best: 'Record',
  newBest: 'Nouveau record !',
  scoreMatches: 'Paires',
  scoreRows: 'Bonus de ligne',
  scoreClearBonus: 'Bonus grille vidée',
  scoreNoHint: 'Bonus sans indice',
  bestScores: 'Meilleurs scores',
  totalBest: 'Total des records par niveau',

  dailyPast: 'Défis passés',
  dailyToday: "Aujourd'hui",
  dailyBacklogHint: 'Terminez un jour pour débloquer le précédent.',
  modeDaily: 'Quotidien',
  undo: 'Annuler',
  hint: 'Indice',
  addNumbers: 'Ajouter',
  timeLabel: 'Temps',
  movesLabel: 'Coups',
  boardLabel: 'Grille de jeu',
  cellLabel: '{value}, ligne {row}, colonne {col}',
  cellLabelStone: 'Pierre, ligne {row}, colonne {col}',
  cellLabelWild: 'Joker, ligne {row}, colonne {col}',
  hintNoneToast: 'Aucune paire — utilisez Ajouter.',
  wildIntroToast: 'La tuile ✦ va avec tous les nombres.',
  stoneIntroToast: "Les pierres ne s'apparient pas et bloquent le passage.",

  clearTitle: 'Grille vidée !',
  clearBody: 'Vous avez retiré tous les nombres.',
  gameOverTitle: 'Plus de coups',
  gameOverBody: 'La grille a atteint sa limite.',
  tryAgain: 'Rejouer cette grille',
  backHome: 'Accueil',

  confirmNewGameTitle: 'Commencer une nouvelle partie ?',
  confirmNewGameBody: 'La partie en cours sera perdue.',
  cancel: 'Annuler',
  confirm: 'Commencer',

  step1Title: 'Égaux, ou somme de 10',
  step1Body: 'Associez deux nombres identiques ou dont la somme fait 10.',
  step2Title: 'Deux nombres reliés',
  step2Body:
    "À l'horizontale, à la verticale, en diagonale — ou de la fin d'une ligne au début de la suivante. Les cases vidées ne gênent pas, mais un nombre encore présent bloque le passage.",
  step3Title: 'Videz la grille pour gagner',
  step3Body:
    'Vous bloquez ? Touchez Ajouter pour ajouter les nombres restants. Annuler et les indices sont toujours gratuits.',
  startPlaying: 'Jouer',
  next: 'Suivant',
  back: 'Retour',
  close: 'Fermer',

  language: 'Langue',
  languageSystem: 'Système',
  theme: 'Thème',
  themeSystem: 'Système',
  themeLight: 'Clair',
  themeDark: 'Sombre',
  sound: 'Son',
  vibration: 'Vibration',
  reducedMotion: 'Réduire les animations',
  privacyPolicy: 'Politique de confidentialité',
  resetData: 'Effacer les données locales',
  resetConfirmTitle: 'Effacer toutes les données locales ?',
  resetConfirmBody:
    'Cela supprime votre partie, vos statistiques et vos paramètres de cet appareil. Cette action est irréversible.',
  delete: 'Effacer',
  version: 'Version',

  privacy1:
    'Aucun compte. Aucune inscription. Nous ne collectons ni votre nom, ni votre e-mail, ni vos contacts, ni votre position.',
  privacy2:
    "Votre progression, vos statistiques et vos paramètres sont enregistrés uniquement sur cet appareil. Nous n'avons aucun serveur et il n'y a aucune synchronisation dans le cloud.",
  privacy3:
    "En ligne, des annonces diffusées par Google AdMob peuvent apparaître ; Google peut traiter les identifiants publicitaires de l'appareil selon sa propre politique de confidentialité. Hors ligne, aucune annonce n'est affichée et aucune requête publicitaire n'est envoyée.",
  privacy4:
    'Désinstaller l\'application, ou utiliser "Effacer les données locales", supprime vos données.',

  played: 'Parties jouées',
  cleared: 'Parties terminées',
  gameOverCount: 'Défaites',
  totalTime: 'Temps de jeu total',
  bestTime: 'Meilleur temps',

  // Collection shell
  collectionTagline: 'Tout gratuit. Tout hors ligne. Prêt à jouer.',
  gamesHeading: 'Jeux',
  numberMatchBlurb: 'Associez les nombres égaux ou dont la somme fait 10.',
  backToGames: 'Tous les jeux',
  learnMore: 'En savoir plus',

  // About & open source
  aboutTitle: 'À propos',
  viewSource: 'Voir le code source',
  reportBug: 'Signaler un bug',
  suggestGame: 'Proposer un jeu',
  viewLicenses: 'Voir les licences',

  // Ads & support
  removeAdsTitle: 'Retirer les pubs et soutenir Simple Games',
  adSupportBody:
    "Simple Games est financé par une petite bannière publicitaire lorsque vous êtes en ligne. Elle nous aide à entretenir et à améliorer l'application. Vous préférez sans publicité ? Un achat unique les retire définitivement.",
  removeAdsAction: 'Retirer les pubs',
  restorePurchase: "Restaurer l'achat",
  purchaseThanks: 'Les bannières publicitaires sont retirées. Merci de soutenir Simple Games.',
  privacy5:
    "Un achat unique facultatif permet de retirer les bannières publicitaires. L'achat est traité par Google Play ; nous ne recevons ni ne conservons aucune donnée de paiement.",

  // Sudoku
  sudokuName: 'Sudoku',
  sudokuBlurb: 'Remplissez chaque ligne, colonne et bloc avec 1-9.',
  sudokuGridLabel: 'Grille de Sudoku',
  sudokuPadLabel: 'Pavé numérique',
  sudokuPadKey: '{value}, {n} restants',
  sudokuPadNoteKey: 'Note {value}',
  sudokuCellEmpty: 'Vide, ligne {row}, colonne {col}',
  sudokuCellGiven: '{value}, initial, ligne {row}, colonne {col}',
  sudokuCellEntry: '{value}, ligne {row}, colonne {col}',
  sudokuErase: 'Effacer',
  sudokuNotes: 'Notes',
  sudokuMistakes: 'Erreurs',
  sudokuTier_easy: 'Facile',
  sudokuTier_medium: 'Moyen',
  sudokuTier_hard: 'Difficile',
  sudokuSolvedTitle: 'Résolu !',
  sudokuSolvedBody: 'Chaque ligne, colonne et bloc contient 1-9.',
  sudokuNewBestTime: 'Votre meilleur temps.',
  sudokuLevelsSolved: 'Niveaux résolus',
  sudokuDailiesSolved: 'Défis résolus',
  sudokuAverageTime: 'Temps moyen',
  sudokuHighlightMistakes: 'Afficher les erreurs',
  sudokuHighlightMistakesNote:
    'Marque un chiffre qui ne correspond pas à la solution. Les doublons sont toujours marqués.',
  sudokuHintNone: 'Rien ne peut encore être déduit.',
  sudokuHintOnlyDigit: 'Un seul chiffre convient à cette case.',
  sudokuHintOnlyCell: 'Ici, {value} ne peut aller que dans cette case.',
  sudokuHintLockedLine: 'Dans ce bloc, {value} ne tient que sur la ligne surlignée.',
  sudokuHintLockedBox: 'Sur cette ligne, {value} ne tient que dans le bloc surligné.',
  sudokuHintRuledOut: 'Ces cases éliminent ces chiffres ailleurs dans le groupe.',
  sudokuStep1Title: '1-9, une fois chacun',
  sudokuStep1Body: 'Chaque ligne, colonne et bloc 3x3 contient 1 à 9 exactement une fois.',
  sudokuStep2Title: 'Notez les candidats',
  sudokuStep2Body:
    "Touchez Notes pour inscrire les candidats pendant que vous réduisez les options d'une case.",
  sudokuStep3Title: 'Vous bloquez ? Prenez un indice',
  sudokuStep3Body:
    "Un indice montre quelle case est décidée et pourquoi. Les indices et l'annulation sont toujours gratuits.",

  // ---- Sliding Puzzle ----
  slideName: 'Taquin',
  slideBlurb: 'Glissez les nombres pour les remettre en ordre.',

  slideBoardLabel: 'Plateau du taquin',
  slideTileLabel: '{value}, ligne {row}, colonne {col}',
  slideBlankLabel: 'Vide, ligne {row}, colonne {col}',
  slideSizeLabel: '{n}x{n}',

  slideMoves: 'Coups',
  slideBestMoves: 'Moins de coups',

  slideSolvedTitle: 'Résolu !',
  slideSolvedBody: 'Tous les nombres sont de nouveau en ordre.',
  slideNewBestMoves: 'Moins de coups que jamais.',
  slideNewBestTime: 'Votre meilleur temps.',

  slideLevelsSolved: 'Niveaux résolus',
  slideDailiesSolved: 'Défis résolus',
  slideDailyBacklogHint: 'Les jours précédents restent toujours accessibles.',

  slideStep1Title: 'Touchez près du vide',
  slideStep1Body: 'Touchez une tuile voisine de la case vide et elle glisse dedans.',
  slideStep2Title: 'Toute une ligne bouge',
  slideStep2Body:
    'Sur la même ligne ou colonne, toutes les tuiles intermédiaires glissent ensemble.',
  slideStep3Title: 'Rangez à partir de 1',
  slideStep3Body: "Alignez les nombres dans l'ordre de lecture, le vide en bas à droite.",

  // ---- 2048 ----
  g2048Name: '2048',
  g2048Blurb: "Réunissez les nombres égaux et doublez-les jusqu'à 2048.",

  g2048ModeClassic: 'Classique',
  g2048DailyPlayedBadge: "Joué aujourd'hui",

  g2048BoardLabel: 'Plateau de 2048',
  g2048CellLabel: '{value}, ligne {row}, colonne {col}',
  g2048CellEmpty: 'Vide, ligne {row}, colonne {col}',
  g2048Restart: 'Recommencer',

  g2048OverBody: 'Le plateau est plein et rien ne peut fusionner.',
  g2048WinTitle: 'Vous avez fait 2048 !',
  g2048WinBody: "Rien ne s'arrête ici — continuez autant que vous voulez.",
  g2048KeepPlaying: 'Continuer',

  g2048BestScore: 'Meilleur score',
  g2048BestTile: 'Plus grande tuile',
  g2048Wins: 'Nombre de 2048 atteints',
  g2048DaysPlayed: 'Jours joués',

  g2048Step1Title: 'Balayez pour bouger',
  g2048Step1Body: "Balayez et toutes les tuiles glissent d'un coup dans ce sens.",
  g2048Step2Title: 'Les nombres égaux fusionnent',
  g2048Step2Body: 'Deux tuiles portant le même nombre donnent leur double.',
  g2048Step3Title: 'Atteignez 2048',
  g2048Step3Body: 'Vous bloquez ? Annuler est gratuit et illimité, autant de fois que vous voulez.',

  // ---- Minesweeper ----
  minesName: 'Démineur',
  minesBlurb: 'Ouvrez toutes les cases sans mine.',

  // Home
  minesChooseBoard: 'Choisissez une grille',
  minesDifficulty_easy: 'Facile',
  minesDifficulty_medium: 'Moyen',
  minesDifficulty_hard: 'Difficile',
  minesBoardNote: '{width}×{height} · {mines} mines',
  minesConfirmSwitchTitle: 'Remplacer la grille en cours ?',
  minesConfirmSwitchBody: 'Votre partie {current} sera remplacée par une nouvelle grille {next}.',

  // Board
  minesBoardLabel: 'Champ de mines, {width} colonnes sur {height} lignes',
  minesCellHidden: 'Non ouverte, ligne {row}, colonne {col}',
  minesCellFlagged: 'Drapeau, ligne {row}, colonne {col}',
  minesCellEmpty: 'Vide, ligne {row}, colonne {col}',
  minesCellNumber: '{count} mines autour, ligne {row}, colonne {col}',
  minesCellMine: 'Mine, ligne {row}, colonne {col}',
  minesMinesLeft: 'Mines restantes',
  minesTapToStart: "Touchez n'importe quelle case. Le premier appui est toujours sûr.",

  // Actions
  minesFlagMode: 'Mode drapeau',
  minesFlagModeNote: 'Un appui pose un drapeau ; un appui long ouvre.',
  minesHintFound: "Cette case est sûre — les nombres surlignés l'expliquent.",
  minesHintNone: 'Rien ne peut encore être déduit.',
  minesNewBoard: 'Nouvelle grille',

  // Result
  minesWonTitle: 'Déminé !',
  minesWonBody: 'Toutes les cases sans mine sont ouvertes.',
  minesLostTitle: 'Mine ouverte',
  minesLostBody: "La partie s'arrête ici. La même grille vous attend quand vous voulez.",
  minesNewBestTime: 'Votre meilleur temps.',
  minesHintsUsed: 'Indices',

  // Statistics
  minesGamesWon: 'Parties gagnées',
  minesWinRate: 'Taux de victoire',
  minesDailySection: 'Quotidien',
  minesDailiesCleared: 'Jours terminés',

  // Quick Rules
  minesStep1Title: 'Le nombre compte les mines',
  minesStep1Body: 'Il indique combien des huit cases autour contiennent une mine.',
  minesStep2Title: 'Marquez ce dont vous êtes sûr',
  minesStep2Body:
    'Appui long sur une case pour la marquer. En mode drapeau, un simple appui suffit.',
  minesStep3Title: 'Ouvrez le reste pour gagner',
  minesStep3Body: "Le premier appui est toujours sûr, et aucune grille n'oblige à deviner.",
};
