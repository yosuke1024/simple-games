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
    'Aucun compte. Aucune inscription. PixApps ne collecte ni votre nom, ni votre e-mail, ni vos contacts, ni votre position.',
  privacy2:
    "Votre progression, vos statistiques et vos paramètres sont enregistrés uniquement sur cet appareil. PixApps n'a aucun serveur et il n'y a aucune synchronisation dans le cloud.",
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
    "Simple Games est financé par une petite bannière publicitaire lorsque vous êtes en ligne. Elle m'aide à entretenir et à améliorer l'application. Vous préférez sans publicité ? Un achat unique les retire définitivement.",
  removeAdsAction: 'Retirer les pubs',
  restorePurchase: "Restaurer l'achat",
  purchaseThanks: 'Les bannières publicitaires sont retirées. Merci de soutenir Simple Games.',

  reviewPromptTitle: 'Simple Games vous plaît ?',
  reviewYes: 'Oui, ça me plaît',
  reviewNo: 'Pas vraiment',
  reviewLater: 'Pas maintenant',
  reviewFeedbackTitle: 'Que pourrait-on améliorer ?',
  reviewFeedbackBody:
    "Dites-le-moi par e-mail — je lis chaque message. Rien n'est envoyé tant que vous n'appuyez pas sur envoyer dans votre app de messagerie.",
  reviewFeedbackAction: 'Écrire un e-mail',
  privacy5:
    "Un achat unique facultatif permet de retirer les bannières publicitaires. L'achat est traité par Google Play ; PixApps ne reçoit ni ne conserve aucune donnée de paiement.",

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

  // ---- Nonogram ----
  nonoName: 'Nonogramme',
  nonoBlurb: 'Peignez les cases que décrivent les nombres.',

  nonoBoardLabel: 'Grille de nonogramme, {size} par {size}',
  nonoCellBlank: 'Vide, ligne {row}, colonne {col}',
  nonoCellFilled: 'Peinte, ligne {row}, colonne {col}',
  nonoCellCrossed: 'Croix, ligne {row}, colonne {col}',
  nonoRowClueLabel: 'Ligne {n} : {clue}',
  nonoColClueLabel: 'Colonne {n} : {clue}',
  nonoSizeLabel: '{n}×{n}',

  nonoXMode: 'Mode X',
  nonoXModeNote: 'Un appui pose une croix ; un appui long peint.',
  nonoHintFound: 'La ligne surlignée détermine une case.',
  nonoHintBroken: 'La ligne surlignée ne correspond plus à son indice.',
  nonoHintNone: 'Aucun coup sûr pour le moment.',

  nonoSolvedTitle: 'Résolu !',
  nonoSolvedBody: 'Tous les indices sont respectés.',
  nonoHintsUsed: 'Indices utilisés',
  nonoNewBestTime: 'Votre meilleur temps.',

  nonoLevelsSolved: 'Niveaux résolus',
  nonoDailiesSolved: 'Défis quotidiens résolus',
  nonoDailyBacklogHint: 'Les jours précédents restent ouverts.',

  nonoStep1Title: 'Les nombres sont des blocs',
  nonoStep1Body: 'Chaque nombre est un bloc de cases peintes, dans l’ordre, avec au moins un espace entre les blocs.',
  nonoStep2Title: 'Éliminez avec une croix',
  nonoStep2Body: 'Marquez d’une croix les cases qui restent vides pour cerner la ligne.',
  nonoStep3Title: 'Respectez chaque ligne',
  nonoStep3Body: 'Quand toutes les lignes et colonnes concordent, la grille est finie. Deviner n’est jamais nécessaire.',

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
