/**
 * Spanish catalog for Make the Target — written by AI from the English source
 * on 2026-10-21 (provenance `machine`, docs/MAKE_THE_TARGET_RULES.md §13). No
 * native speaker has read it; it is not to be treated as reviewed. Neutral,
 * Latin-America-leaning Spanish like the rest of the collection. The title
 * (`makeTheTargetName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source.
 *
 * Terms: problem = problema, target = objetivo (not meta or puntuación),
 * solution = solución, the result of one move = resultado. Division is read
 * "dividido entre", left term first. Shared words follow the shell and Bridges
 * (Fácil / Medio / Difícil, Diario, Días completados).
 */
import type { MakeTheTargetMessages } from './en';

export const es: MakeTheTargetMessages = {
  makeTheTargetName: 'Make the Target',
  makeTheTargetChooseTier: 'Elige una dificultad',
  makeTheTargetDifficulty_easy: 'Fácil',
  makeTheTargetDifficulty_medium: 'Medio',
  makeTheTargetDifficulty_hard: 'Difícil',
  makeTheTargetTierNote_easy: '4 números',
  makeTheTargetTierNote_medium: '4 o 5 números',
  makeTheTargetTierNote_hard: '5 números',
  makeTheTargetConfirmSwitchTitle: '¿Reemplazar el problema en curso?',
  makeTheTargetConfirmSwitchBody:
    'Tu problema {current} se reemplazará por un problema {next} nuevo.',
  makeTheTargetNumbersLabel: 'Números',
  makeTheTargetTargetSpoken: 'Objetivo {target}',
  makeTheTargetTargetLabel: 'Objetivo',
  makeTheTargetOperatorsLabel: 'Operadores',
  makeTheTargetOp_add: 'Sumar',
  makeTheTargetOp_subtract: 'Restar',
  makeTheTargetOp_multiply: 'Multiplicar',
  makeTheTargetOp_divide: 'Dividir',
  makeTheTargetSpokenLine_add: '{left} más {right} es igual a {result}',
  makeTheTargetSpokenLine_subtract: '{left} menos {right} es igual a {result}',
  makeTheTargetSpokenLine_multiply: '{left} por {right} es igual a {result}',
  makeTheTargetSpokenLine_divide: '{left} dividido entre {right} es igual a {result}',
  makeTheTargetSpokenUndo: 'Deshecho: {line}',
  makeTheTargetStepsLabel: 'Pasos hasta ahora',
  makeTheTargetMissed: 'Eso da {value}, no {target}.',
  makeTheTargetSpokenMissed: '{line}. Eso da {value}, no {target}.',
  makeTheTargetShowSolution: 'Ver una solución',
  makeTheTargetRevealTitle: '¿Ver una solución?',
  makeTheTargetRevealBody: 'Este problema termina aquí y no cuenta como resuelto.',
  makeTheTargetRevealConfirm: 'Ver',
  makeTheTargetSolvedTitle: 'Objetivo alcanzado.',
  makeTheTargetRevealedTitle: 'Una forma de obtener {target}',
  makeTheTargetSolutionLabel: 'Una solución',
  makeTheTargetNewBoard: 'Problema nuevo',
  makeTheTargetNewBestTime: 'Tu tiempo más rápido.',
  makeTheTargetSolvedCount: 'Problemas resueltos',
  makeTheTargetDailySection: 'Diario',
  makeTheTargetDailiesCleared: 'Días completados',
  makeTheTargetAllModes: 'Todos los modos',
  makeTheTargetStep1Title: 'Combina dos',
  makeTheTargetStep1Body:
    'Toca un número, luego + − × o ÷, y luego otro número: el primero que tocas queda a la izquierda.',
  makeTheTargetStep2Title: 'Un número nuevo',
  makeTheTargetStep2Body:
    'Los dos se gastan y el resultado (siempre un número entero mayor que cero) ocupa su lugar.',
  makeTheTargetStep3Title: 'Alcanza el objetivo',
  makeTheTargetStep3Body:
    'Usa todos los números. Cuando el último es igual al objetivo, el problema está resuelto.',
};
