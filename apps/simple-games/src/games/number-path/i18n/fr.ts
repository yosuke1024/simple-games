/**
 * French catalog of Number Path (docs/I18N_POLICY.md: provenance `machine` — written
 * with AI assistance and not yet read by a native speaker). The title is a proper
 * noun and stays as-is.
 */
import type { NumberPathMessages } from './en';

export const fr: NumberPathMessages = {
  numberPathName: 'Number Path',
  numberPathChooseBoard: 'Choisir une grille',
  numberPathDifficulty_easy: 'Facile',
  numberPathDifficulty_medium: 'Moyen',
  numberPathDifficulty_hard: 'Difficile',
  numberPathBoardNote: '{width}×{height}',
  numberPathBoardLabel: 'Grille Number Path, {width} sur {height}',
  numberPathCellPlain: 'Ligne {row}, colonne {col}',
  numberPathCellNumber: 'Numéro {n}, ligne {row}, colonne {col}',
  numberPathOnPath: 'sur le chemin, étape {step}',
  numberPathOffPath: 'hors du chemin',
  numberPathHintNext: 'La case marquée est la prochaine étape.',
  numberPathHintBack: 'Le chemin s’est écarté. Reculez jusqu’à la case marquée.',
  numberPathHintNone: 'Pas d’indice pour le moment.',
  numberPathHintMarked: 'indice',
  numberPathSolvedTitle: 'Résolu !',
  numberPathSolvedBody: 'Une ligne, chaque case, dans l’ordre.',
  numberPathHintsUsed: 'Indices utilisés',
  numberPathNewBestTime: 'Votre meilleur temps.',
  numberPathNewBoard: 'Nouvelle grille',
  numberPathSolvedCount: 'Grilles résolues',
  numberPathDailySection: 'Quotidien',
  numberPathDailiesSolved: 'Jours résolus',
  numberPathDailyBacklogHint: 'Les jours précédents restent ouverts.',
  numberPathStep1Title: 'Suivez les numéros',
  numberPathStep1Body:
    'Tracez une seule ligne depuis le 1 en passant par les numéros dans l’ordre.',
  numberPathStep2Title: 'Couvrez chaque case',
  numberPathStep2Body:
    'La ligne passe une fois par chaque case et se termine sur le dernier numéro.',
  numberPathStep3Title: 'Les murs barrent la route',
  numberPathStep3Body:
    'Un bord épais ne se traverse pas ; pour reculer, faites glisser en arrière le long de la ligne ou touchez une de ses cases.',
};
