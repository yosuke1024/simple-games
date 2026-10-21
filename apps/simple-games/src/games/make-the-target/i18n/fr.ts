/**
 * French catalog for Make the Target — written by AI from the English source
 * on 2026-10-21 (provenance `machine`, docs/MAKE_THE_TARGET_RULES.md §13). No
 * native speaker has read it; it is not to be treated as reviewed. The title
 * (`makeTheTargetName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source.
 *
 * Terms: problem = problème, target = cible (not but or score), solution =
 * solution, the result of one move = résultat. Division is read "divisé par",
 * left term first. Undo is the shell's « Annuler », so a move taken back is
 * « Annulé ». Shared words follow the shell and Bridges (Facile / Moyen /
 * Difficile, Quotidien, Jours réussis). A no-break space keeps « ? » and « : »
 * on their word's line.
 */
import type { MakeTheTargetMessages } from './en';

export const fr: MakeTheTargetMessages = {
  makeTheTargetName: 'Make the Target',
  makeTheTargetChooseTier: 'Choisir une difficulté',
  makeTheTargetDifficulty_easy: 'Facile',
  makeTheTargetDifficulty_medium: 'Moyen',
  makeTheTargetDifficulty_hard: 'Difficile',
  makeTheTargetTierNote_easy: '4 nombres',
  makeTheTargetTierNote_medium: '4 ou 5 nombres',
  makeTheTargetTierNote_hard: '5 nombres',
  makeTheTargetConfirmSwitchTitle: 'Remplacer le problème en cours\u00a0?',
  makeTheTargetConfirmSwitchBody:
    'Votre problème {current} sera remplacé par un nouveau problème {next}.',
  makeTheTargetNumbersLabel: 'Nombres',
  makeTheTargetTargetSpoken: 'Cible {target}',
  makeTheTargetTargetLabel: 'Cible',
  makeTheTargetOperatorsLabel: 'Opérateurs',
  makeTheTargetOp_add: 'Additionner',
  makeTheTargetOp_subtract: 'Soustraire',
  makeTheTargetOp_multiply: 'Multiplier',
  makeTheTargetOp_divide: 'Diviser',
  makeTheTargetSpokenLine_add: '{left} plus {right} égale {result}',
  makeTheTargetSpokenLine_subtract: '{left} moins {right} égale {result}',
  makeTheTargetSpokenLine_multiply: '{left} fois {right} égale {result}',
  makeTheTargetSpokenLine_divide: '{left} divisé par {right} égale {result}',
  makeTheTargetSpokenUndo: 'Annulé\u00a0: {line}',
  makeTheTargetStepsLabel: 'Calculs effectués',
  makeTheTargetMissed: 'Cela donne {value}, pas {target}.',
  makeTheTargetSpokenMissed: '{line}. Cela donne {value}, pas {target}.',
  makeTheTargetShowSolution: 'Voir une solution',
  makeTheTargetRevealTitle: 'Voir une solution\u00a0?',
  makeTheTargetRevealBody: 'Ce problème s’arrête ici et ne compte pas comme résolu.',
  makeTheTargetRevealConfirm: 'Voir',
  makeTheTargetSolvedTitle: 'Cible atteinte.',
  makeTheTargetRevealedTitle: 'Une façon d’obtenir {target}',
  makeTheTargetSolutionLabel: 'Une solution',
  makeTheTargetNewBoard: 'Nouveau problème',
  makeTheTargetNewBestTime: 'Votre meilleur temps.',
  makeTheTargetSolvedCount: 'Problèmes résolus',
  makeTheTargetDailySection: 'Quotidien',
  makeTheTargetDailiesCleared: 'Jours réussis',
  makeTheTargetAllModes: 'Tous les modes',
  makeTheTargetStep1Title: 'Combiner deux',
  makeTheTargetStep1Body:
    'Touchez un nombre, puis + − × ou ÷, puis un autre nombre\u00a0: le premier touché est à gauche.',
  makeTheTargetStep2Title: 'Un nouveau nombre',
  makeTheTargetStep2Body:
    'Les deux sont utilisés, et le résultat\u00a0— toujours un entier supérieur à zéro\u00a0— prend leur place.',
  makeTheTargetStep3Title: 'Atteindre la cible',
  makeTheTargetStep3Body:
    'Utilisez tous les nombres. Quand le dernier est égal à la cible, le problème est résolu.',
};
