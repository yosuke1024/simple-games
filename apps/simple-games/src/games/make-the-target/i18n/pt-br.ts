/**
 * Brazilian Portuguese catalog for Make the Target — written by AI from the
 * English source on 2026-10-21 (provenance `machine`,
 * docs/MAKE_THE_TARGET_RULES.md §13). No native speaker has read it; it is not
 * to be treated as reviewed. The title (`makeTheTargetName`) is a proper noun
 * and stays as-is in every locale; placeholder names match the English source.
 *
 * Terms: problem = problema, target = alvo (not meta or pontuação), solution =
 * solução, the result of one move = resultado. Division is read "dividido
 * por", left term first. Shared words follow the shell and Bridges (Fácil /
 * Médio / Difícil, Diário, Dias concluídos).
 */
import type { MakeTheTargetMessages } from './en';

export const ptBR: MakeTheTargetMessages = {
  makeTheTargetName: 'Make the Target',
  makeTheTargetChooseTier: 'Escolha uma dificuldade',
  makeTheTargetDifficulty_easy: 'Fácil',
  makeTheTargetDifficulty_medium: 'Médio',
  makeTheTargetDifficulty_hard: 'Difícil',
  makeTheTargetTierNote_easy: '4 números',
  makeTheTargetTierNote_medium: '4 ou 5 números',
  makeTheTargetTierNote_hard: '5 números',
  makeTheTargetConfirmSwitchTitle: 'Substituir o problema em andamento?',
  makeTheTargetConfirmSwitchBody:
    'Seu problema {current} será substituído por um novo problema {next}.',
  makeTheTargetNumbersLabel: 'Números',
  makeTheTargetTargetSpoken: 'Alvo {target}',
  makeTheTargetTargetLabel: 'Alvo',
  makeTheTargetOperatorsLabel: 'Operadores',
  makeTheTargetOp_add: 'Somar',
  makeTheTargetOp_subtract: 'Subtrair',
  makeTheTargetOp_multiply: 'Multiplicar',
  makeTheTargetOp_divide: 'Dividir',
  makeTheTargetSpokenLine_add: '{left} mais {right} é igual a {result}',
  makeTheTargetSpokenLine_subtract: '{left} menos {right} é igual a {result}',
  makeTheTargetSpokenLine_multiply: '{left} vezes {right} é igual a {result}',
  makeTheTargetSpokenLine_divide: '{left} dividido por {right} é igual a {result}',
  makeTheTargetSpokenUndo: 'Desfeito: {line}',
  makeTheTargetStepsLabel: 'Passos até agora',
  makeTheTargetMissed: 'Isso dá {value}, não {target}.',
  makeTheTargetSpokenMissed: '{line}. Isso dá {value}, não {target}.',
  makeTheTargetShowSolution: 'Ver uma solução',
  makeTheTargetRevealTitle: 'Ver uma solução?',
  makeTheTargetRevealBody: 'Este problema termina aqui e não conta como resolvido.',
  makeTheTargetRevealConfirm: 'Ver',
  makeTheTargetSolvedTitle: 'Alvo alcançado.',
  makeTheTargetRevealedTitle: 'Uma forma de obter {target}',
  makeTheTargetSolutionLabel: 'Uma solução',
  makeTheTargetNewBoard: 'Novo problema',
  makeTheTargetNewBestTime: 'Seu tempo mais rápido.',
  makeTheTargetSolvedCount: 'Problemas resolvidos',
  makeTheTargetDailySection: 'Diário',
  makeTheTargetDailiesCleared: 'Dias concluídos',
  makeTheTargetAllModes: 'Todos os modos',
  makeTheTargetStep1Title: 'Combine dois',
  makeTheTargetStep1Body:
    'Toque em um número, depois em + − × ou ÷ e depois em outro número: o primeiro tocado fica à esquerda.',
  makeTheTargetStep2Title: 'Um número novo',
  makeTheTargetStep2Body:
    'Os dois são consumidos e o resultado\u00a0— sempre um número inteiro maior que zero\u00a0— fica no lugar deles.',
  makeTheTargetStep3Title: 'Chegue ao alvo',
  makeTheTargetStep3Body:
    'Use todos os números. Quando o último for igual ao alvo, o problema está resolvido.',
};
