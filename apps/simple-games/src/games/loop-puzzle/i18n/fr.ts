/**
 * French catalog for Loop Puzzle — written with AI assistance from the
 * English source (provenance `machine`, docs/LOOP_PUZZLE_RULES.md §14). No
 * native speaker has read it; it is not to be treated as reviewed. The title
 * (`loopPuzzleName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source. Terms follow the shell
 * (`hint` = Indice) and Box Regions (board = grille). « Ligne » already names
 * a row, so a drawn edge is a trait (never « ligne »); an edge is a segment,
 * the loop a boucle, a clue a chiffre.
 */
import type { LoopPuzzleMessages } from './en';

export const fr: LoopPuzzleMessages = {
  loopPuzzleName: 'Loop Puzzle',
  loopPuzzleChooseBoard: 'Choisir une grille',
  loopPuzzleDifficulty_easy: 'Facile',
  loopPuzzleDifficulty_medium: 'Moyen',
  loopPuzzleDifficulty_hard: 'Difficile',
  loopPuzzleBoardNote: '{width}×{height}',
  loopPuzzleConfirmSwitchTitle: 'Remplacer la grille en cours ?',
  loopPuzzleConfirmSwitchBody:
    'Votre partie {current} sera remplacée par une nouvelle grille {next}.',
  loopPuzzleBoardLabel: 'Grille Loop Puzzle, {width} sur {height}',
  loopPuzzleEdgeHEmpty: 'Segment horizontal, ligne {row}, colonne {col}, vide',
  loopPuzzleEdgeHLine: 'Segment horizontal, ligne {row}, colonne {col}, trait',
  loopPuzzleEdgeHCross: 'Segment horizontal, ligne {row}, colonne {col}, marqué d’un ×',
  loopPuzzleEdgeVEmpty: 'Segment vertical, ligne {row}, colonne {col}, vide',
  loopPuzzleEdgeVLine: 'Segment vertical, ligne {row}, colonne {col}, trait',
  loopPuzzleEdgeVCross: 'Segment vertical, ligne {row}, colonne {col}, marqué d’un ×',
  loopPuzzleClueOpen: 'Chiffre {n}, ligne {row}, colonne {col}',
  loopPuzzleClueMet: 'Chiffre {n}, ligne {row}, colonne {col}, satisfait',
  loopPuzzleClueTooMany: 'Chiffre {n}, ligne {row}, colonne {col}, trop de traits',
  loopPuzzleClueTooFew: 'Chiffre {n}, ligne {row}, colonne {col}, impossible à satisfaire',
  loopPuzzleNoteHint: 'Marqué par l’indice',
  loopPuzzleNoteConflict: 'Enfreint une règle',
  loopPuzzleConflictBranch: 'Un point a plus de deux traits.',
  loopPuzzleConflictDeadEnd: 'Un trait s’arrête à un point sans issue.',
  loopPuzzleConflictLoop: 'Une boucle fermée laisse d’autres traits à l’extérieur.',
  loopPuzzleConflictTooMany: 'Un chiffre a plus de traits qu’il n’en indique.',
  loopPuzzleConflictTooFew: 'Un chiffre ne peut plus avoir assez de traits.',
  loopPuzzleConflictClosed: 'La boucle est fermée, mais un chiffre ne correspond pas.',
  loopPuzzleHintWrongLine: 'Le trait marqué ne fait pas partie de la boucle.',
  loopPuzzleHintWrongCross: 'La boucle passe par le × marqué.',
  loopPuzzleHintCellLine: 'Le chiffre entouré exige un trait sur le segment marqué.',
  loopPuzzleHintCellCross: 'Le chiffre entouré n’admet pas de trait sur le segment marqué.',
  loopPuzzleHintDotLine: 'Au point entouré, la boucle doit passer par le segment marqué.',
  loopPuzzleHintDotCross: 'Au point entouré, le segment marqué ne peut pas être un trait.',
  loopPuzzleHintLoopCross: 'Un trait sur le segment marqué fermerait une boucle trop tôt.',
  loopPuzzleHintClosedCross: 'La boucle est fermée, donc le segment marqué n’en fait pas partie.',
  loopPuzzleHintTrialLine: 'Sans trait sur le segment marqué, on aboutit à une contradiction.',
  loopPuzzleHintTrialCross: 'Un trait sur le segment marqué mène à une contradiction.',
  loopPuzzleHintRevealLine: 'Le segment marqué fait partie de la boucle.',
  loopPuzzleHintRevealCross: 'Le segment marqué ne fait pas partie de la boucle.',
  loopPuzzleHintNone: 'Pas d’indice pour le moment.',
  loopPuzzleSolvedTitle: 'Résolu !',
  loopPuzzleSolvedBody: 'Une seule boucle fermée, chaque chiffre satisfait.',
  loopPuzzleHintsUsed: 'Indices utilisés',
  loopPuzzleNewBestTime: 'Votre meilleur temps.',
  loopPuzzleNewBoard: 'Nouvelle grille',
  loopPuzzleSolvedCount: 'Grilles résolues',
  loopPuzzleDailySection: 'Quotidien',
  loopPuzzleDailiesCleared: 'Jours réussis',
  loopPuzzleAllBoards: 'Toutes les grilles',
  loopPuzzleStep1Title: 'Une seule boucle fermée',
  loopPuzzleStep1Body:
    'Reliez les points en une seule boucle fermée, sans embranchement ni croisement.',
  loopPuzzleStep2Title: 'Lisez les chiffres',
  loopPuzzleStep2Body: 'Un chiffre indique combien de ses quatre côtés la boucle emprunte.',
  loopPuzzleStep3Title: 'Touchez un segment',
  loopPuzzleStep3Body:
    'Chaque toucher change le segment en trait, puis en × (hors de la boucle), puis en vide.',
};
