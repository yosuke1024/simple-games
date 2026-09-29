/**
 * fr catalog for Binary Balance: a machine translation of the English
 * source, not yet reviewed by a native speaker (docs/I18N_POLICY.md). The
 * title (`binaryBalanceName`) is a proper noun and stays as-is; wording follows
 * the Takuzu catalog where the meaning is the same. The two marks are a sun
 * and a moon (the ordinary words for the celestial bodies).
 */
import type { BinaryBalanceMessages } from './en';

export const fr: BinaryBalanceMessages = {
  binaryBalanceName: 'Binary Balance',
  binaryBalanceChooseBoard: 'Choisissez une grille',
  binaryBalanceDifficulty_easy: 'Facile',
  binaryBalanceDifficulty_medium: 'Moyen',
  binaryBalanceDifficulty_hard: 'Difficile',
  binaryBalanceBoardNote: '{size}×{size}',
  binaryBalanceConfirmSwitchTitle: 'Remplacer la grille en cours ?',
  binaryBalanceConfirmSwitchBody:
    'Votre partie {current} sera remplacée par une nouvelle grille {next}.',
  binaryBalanceBoardLabel: 'Grille de Binary Balance, {size} par {size}',
  binaryBalanceCellEmpty: 'Vide, ligne {row}, colonne {col}',
  binaryBalanceCellSun: 'Soleil, ligne {row}, colonne {col}',
  binaryBalanceCellMoon: 'Lune, ligne {row}, colonne {col}',
  binaryBalanceCellFixedSun: 'Soleil initial, ligne {row}, colonne {col}',
  binaryBalanceCellFixedMoon: 'Lune initiale, ligne {row}, colonne {col}',
  binaryBalanceLinkSameRight: 'identique à la case de droite',
  binaryBalanceLinkDiffRight: 'différente de la case de droite',
  binaryBalanceLinkSameBelow: 'identique à la case du dessous',
  binaryBalanceLinkDiffBelow: 'différente de la case du dessous',
  binaryBalanceRuleBroken: 'enfreint une règle',
  binaryBalanceMarkSun: 'un soleil',
  binaryBalanceMarkMoon: 'une lune',
  binaryBalanceHintViolation: 'Les cases surlignées enfreignent une règle.',
  binaryBalanceHintWrong: 'La marque cerclée ne peut pas être la bonne.',
  binaryBalanceHintPairGap:
    'La paire teintée ferait trois à la suite, donc la case cerclée est {mark}.',
  binaryBalanceHintLineCount:
    'La ligne surlignée contient déjà sa moitié de la marque teintée, donc la case cerclée est {mark}.',
  binaryBalanceHintLinkSame:
    'Un = relie la case cerclée à la case teintée, donc elle est aussi {mark}.',
  binaryBalanceHintLinkDiff:
    'Un × relie la case cerclée à la case teintée, donc elle prend l’autre marque : {mark}.',
  binaryBalanceHintLineCompletion:
    'Toutes les façons de finir la ligne surlignée mettent {mark} dans la case cerclée.',
  binaryBalanceHintHypothesis:
    'Si la case cerclée était {other}, les coups suivants enfreindraient une règle, donc elle est {mark}.',
  binaryBalanceHintNone: 'Aucun coup sûr pour le moment.',
  binaryBalanceSolvedTitle: 'Résolu !',
  binaryBalanceSolvedBody: 'Toutes les lignes sont équilibrées et tous les liens sont respectés.',
  binaryBalanceHintsUsed: 'Indices utilisés',
  binaryBalanceNewBestTime: 'Votre meilleur temps.',
  binaryBalanceNewBoard: 'Nouvelle grille',
  binaryBalanceDailySection: 'Quotidien',
  binaryBalanceDailiesSolved: 'Jours résolus',
  binaryBalanceDailyBacklogHint: 'Les jours précédents restent ouverts.',
  binaryBalanceStep1Title: 'Jamais trois à la suite',
  binaryBalanceStep1Body:
    'Touchez pour passer de vide à soleil, puis à lune. La même marque ne se répète jamais trois fois à la suite.',
  binaryBalanceStep2Title: 'Moitié-moitié',
  binaryBalanceStep2Body: 'Chaque ligne et chaque colonne compte autant de soleils que de lunes.',
  binaryBalanceStep3Title: 'Suivez les liens',
  binaryBalanceStep3Body:
    'Les cases reliées par = sont identiques ; celles reliées par × sont différentes. Bloqué ? Demandez un indice.',
};
