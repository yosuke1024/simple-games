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
  crownGridHintSingle_row:
    "La ligne surlignée n'a plus qu'une case pour sa couronne : celle qui est encadrée.",
  crownGridHintSingle_col:
    "La colonne surlignée n'a plus qu'une case pour sa couronne : celle qui est encadrée.",
  crownGridHintSingle_region:
    "La zone surlignée n'a plus qu'une case pour sa couronne : celle qui est encadrée.",
  crownGridHintConfine_regionRow:
    'La zone surlignée ne peut avoir sa couronne que sur les cases teintées, toutes situées sur une même ligne — les autres cases de cette ligne (encadrées) sont donc exclues.',
  crownGridHintConfine_regionCol:
    'La zone surlignée ne peut avoir sa couronne que sur les cases teintées, toutes situées sur une même colonne — les autres cases de cette colonne (encadrées) sont donc exclues.',
  crownGridHintConfine_rowRegion:
    'La ligne surlignée ne peut avoir sa couronne que sur les cases teintées, toutes situées dans une même zone — les autres cases de cette zone (encadrées) sont donc exclues.',
  crownGridHintConfine_colRegion:
    'La colonne surlignée ne peut avoir sa couronne que sur les cases teintées, toutes situées dans une même zone — les autres cases de cette zone (encadrées) sont donc exclues.',
  crownGridHintAttack_row:
    'Une couronne sur la case encadrée éliminerait toutes les cases teintées, ne laissant plus aucune place pour la couronne de la ligne surlignée.',
  crownGridHintAttack_col:
    'Une couronne sur la case encadrée éliminerait toutes les cases teintées, ne laissant plus aucune place pour la couronne de la colonne surlignée.',
  crownGridHintAttack_region:
    'Une couronne sur la case encadrée éliminerait toutes les cases teintées, ne laissant plus aucune place pour la couronne de la zone surlignée.',
  crownGridHintPair_regionsRows:
    'Les deux zones surlignées ne peuvent avoir leurs couronnes que sur les cases teintées, qui tiennent dans exactement deux lignes — les autres cases de ces lignes (encadrées) sont donc exclues.',
  crownGridHintPair_regionsCols:
    'Les deux zones surlignées ne peuvent avoir leurs couronnes que sur les cases teintées, qui tiennent dans exactement deux colonnes — les autres cases de ces colonnes (encadrées) sont donc exclues.',
  crownGridHintPair_rowsRegions:
    'Les deux lignes surlignées ne peuvent avoir leurs couronnes que sur les cases teintées, qui tiennent dans exactement deux zones — les autres cases de ces zones (encadrées) sont donc exclues.',
  crownGridHintPair_colsRegions:
    'Les deux colonnes surlignées ne peuvent avoir leurs couronnes que sur les cases teintées, qui tiennent dans exactement deux zones — les autres cases de ces zones (encadrées) sont donc exclues.',
  crownGridHintHypothesis_row:
    "Essayez une couronne sur la case encadrée : les coups qu'elle impose ne laissent plus aucune place pour la couronne de la ligne surlignée, elle ne peut donc pas être la bonne.",
  crownGridHintHypothesis_col:
    "Essayez une couronne sur la case encadrée : les coups qu'elle impose ne laissent plus aucune place pour la couronne de la colonne surlignée, elle ne peut donc pas être la bonne.",
  crownGridHintHypothesis_region:
    "Essayez une couronne sur la case encadrée : les coups qu'elle impose ne laissent plus aucune place pour la couronne de la zone surlignée, elle ne peut donc pas être la bonne.",
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
