import type { CrownGridMessages } from './en';

export const fr: CrownGridMessages = {
  crownGridName: 'Crown Grid',
  crownGridChooseBoard: 'Choisissez une grille',
  crownGridDifficulty_easy: 'Facile',
  crownGridDifficulty_medium: 'Moyen',
  crownGridDifficulty_hard: 'Difficile',
  crownGridBoardNote: '{size}×{size}',
  crownGridConfirmSwitchTitle: 'Remplacer la grille en cours ?',
  crownGridConfirmSwitchBody:
    'Votre partie {current} sera remplacée par une nouvelle grille {next}.',
  crownGridBoardLabel: 'Grille de Crown Grid, {size} par {size}',
  crownGridCellEmpty: 'Vide, ligne {row}, colonne {col}, zone {region}',
  crownGridCellCross: 'Barrée, ligne {row}, colonne {col}, zone {region}',
  crownGridCellCrown: 'Couronne, ligne {row}, colonne {col}, zone {region}',
  crownGridRuleBroken: 'enfreint une règle',
  crownGridHintViolation: 'Les couronnes surlignées enfreignent une règle.',
  crownGridHintWrong: 'La couronne marquée ne peut pas être juste.',
  crownGridHintPlace:
    'La case marquée doit recevoir une couronne — la zone surlignée montre pourquoi.',
  crownGridHintEliminate:
    'Aucune couronne ne peut aller sur les cases marquées — la zone surlignée montre pourquoi.',
  crownGridHintNone: 'Aucun coup sûr pour le moment.',
  crownGridSolvedTitle: 'Résolu !',
  crownGridSolvedBody: 'Chaque ligne, chaque colonne et chaque zone contient une couronne.',
  crownGridHintsUsed: 'Indices utilisés',
  crownGridNewBestTime: 'Votre meilleur temps.',
  crownGridNewBoard: 'Nouvelle grille',
  crownGridDailySection: 'Quotidien',
  crownGridDailiesSolved: 'Jours résolus',
  crownGridDailyBacklogHint: 'Les jours précédents restent ouverts.',
  crownGridStep1Title: 'Une couronne chacun',
  crownGridStep1Body:
    'Chaque ligne, chaque colonne et chaque couleur contient exactement une couronne.',
  crownGridStep2Title: 'Les couronnes ne se touchent pas',
  crownGridStep2Body: 'Deux couronnes ne sont jamais voisines, même en diagonale.',
  crownGridStep3Title: 'Toucher et glisser',
  crownGridStep3Body:
    'Touchez une case pour alterner ×, couronne, vide ; glissez pour poser plusieurs ×. Bloqué ? Demandez un indice.',
};
