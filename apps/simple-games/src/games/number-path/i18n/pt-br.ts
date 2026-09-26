/**
 * Brazilian Portuguese catalog of Number Path (docs/I18N_POLICY.md: provenance `machine` — written
 * with AI assistance and not yet read by a native speaker). The title is a proper
 * noun and stays as-is.
 */
import type { NumberPathMessages } from './en';

export const ptBR: NumberPathMessages = {
  numberPathName: 'Number Path',
  numberPathChooseBoard: 'Escolha um tabuleiro',
  numberPathDifficulty_easy: 'Fácil',
  numberPathDifficulty_medium: 'Médio',
  numberPathDifficulty_hard: 'Difícil',
  numberPathBoardNote: '{width}×{height}',
  numberPathBoardLabel: 'Tabuleiro de Number Path, {width} por {height}',
  numberPathCellPlain: 'Linha {row}, coluna {col}',
  numberPathCellNumber: 'Número {n}, linha {row}, coluna {col}',
  numberPathOnPath: 'no caminho, passo {step}',
  numberPathOffPath: 'fora do caminho',
  numberPathHintNext: 'A casa marcada é o próximo passo.',
  numberPathHintBack: 'O caminho saiu da rota. Volte até a casa marcada.',
  numberPathHintNone: 'Nenhuma dica por enquanto.',
  numberPathHintMarked: 'dica',
  numberPathSolvedTitle: 'Resolvido!',
  numberPathSolvedBody: 'Uma linha, todas as casas, em ordem.',
  numberPathHintsUsed: 'Dicas usadas',
  numberPathNewBestTime: 'Seu melhor tempo até agora.',
  numberPathNewBoard: 'Novo tabuleiro',
  numberPathSolvedCount: 'Tabuleiros resolvidos',
  numberPathDailySection: 'Diário',
  numberPathDailiesSolved: 'Dias resolvidos',
  numberPathDailyBacklogHint: 'Todos os dias anteriores continuam abertos.',
  numberPathStep1Title: 'Siga os números',
  numberPathStep1Body: 'Trace uma única linha a partir do 1, passando pelos números em ordem.',
  numberPathStep2Title: 'Cubra todas as casas',
  numberPathStep2Body: 'A linha passa por cada casa uma vez e termina no último número.',
  numberPathStep3Title: 'Paredes fecham o caminho',
  numberPathStep3Body:
    'Uma borda grossa não pode ser cruzada; para voltar, arraste de volta pela linha ou toque em uma casa dela.',
};
