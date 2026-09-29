/**
 * French catalog for Sudoku 6×6 — a machine translation of the English
 * source, not yet reviewed (docs/I18N_POLICY.md). The title
 * (`sudoku6x6Name`) is a proper noun. Wording follows the 9×9 Sudoku
 * catalog wherever the meaning is the same.
 */
import type { Sudoku6x6Messages } from './en';

export const fr: Sudoku6x6Messages = {
  sudoku6x6Name: 'Sudoku 6×6',
  sudoku6x6ChooseBoard: 'Choisir une grille',
  sudoku6x6Difficulty_easy: 'Facile',
  sudoku6x6Difficulty_medium: 'Moyen',
  sudoku6x6Difficulty_hard: 'Difficile',
  sudoku6x6ConfirmSwitchTitle: 'Remplacer la grille en cours ?',
  sudoku6x6ConfirmSwitchBody:
    'Votre partie {current} sera remplacée par une nouvelle grille {next}.',
  sudoku6x6GridLabel: 'Grille de Sudoku 6×6',
  sudoku6x6PadLabel: 'Pavé numérique',
  sudoku6x6PadKey: '{value}, {n} restants',
  sudoku6x6PadNoteKey: 'Note {value}',
  sudoku6x6CellEmpty: 'Vide, ligne {row}, colonne {col}',
  sudoku6x6CellGiven: '{value}, initial, ligne {row}, colonne {col}',
  sudoku6x6CellEntry: '{value}, ligne {row}, colonne {col}',
  sudoku6x6Erase: 'Effacer',
  sudoku6x6Notes: 'Notes',
  sudoku6x6HintOnlyDigit: 'Un seul chiffre convient à cette case.',
  sudoku6x6HintOnlyCell: 'Ici, {value} ne peut aller que dans cette case.',
  sudoku6x6HintLockedLine: 'Dans ce bloc, {value} ne tient que sur la ligne surlignée.',
  sudoku6x6HintLockedBox: 'Sur cette ligne, {value} ne tient que dans le bloc surligné.',
  sudoku6x6HintRuledOut: 'Ces cases éliminent ces chiffres ailleurs dans le groupe.',
  sudoku6x6HintNone: 'Rien ne peut encore être déduit.',
  sudoku6x6SolvedTitle: 'Résolu !',
  sudoku6x6SolvedBody: 'Chaque ligne, colonne et bloc contient 1-6.',
  sudoku6x6Mistakes: 'Erreurs',
  sudoku6x6HintsUsed: 'Indices utilisés',
  sudoku6x6NewBestTime: 'Votre meilleur temps.',
  sudoku6x6NewBoard: 'Nouvelle grille',
  sudoku6x6DailySection: 'Quotidien',
  sudoku6x6DailiesSolved: 'Jours résolus',
  sudoku6x6DailyBacklogHint: 'Tous les jours précédents restent ouverts.',
  sudoku6x6HighlightMistakes: 'Afficher les erreurs',
  sudoku6x6HighlightMistakesNote:
    'Marque un chiffre faux dès qu’il est placé. Les doublons sont toujours marqués.',
  sudoku6x6Step1Title: '1-6, une fois chacun',
  sudoku6x6Step1Body: 'Chaque ligne, colonne et bloc 2×3 contient 1 à 6 exactement une fois.',
  sudoku6x6Step2Title: 'Remplissez et notez',
  sudoku6x6Step2Body:
    'Choisissez une case et touchez un chiffre. Activez Notes pour inscrire les candidats.',
  sudoku6x6Step3Title: 'Vous bloquez ? Prenez un indice',
  sudoku6x6Step3Body: 'Un indice montre la prochaine case dont vous pouvez être sûr, et pourquoi.',
};
