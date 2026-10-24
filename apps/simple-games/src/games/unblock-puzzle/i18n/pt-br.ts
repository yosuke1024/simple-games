/**
 * Brazilian Portuguese catalog for Unblock Puzzle. Provenance: `machine` — written with
 * AI assistance from the English source; no native speaker has read it
 * (docs/UNBLOCK_PUZZLE_RULES.md §15, docs/I18N_POLICY.md「翻訳の状態は来歴と
 * 検証できた事実で書く」). The title (`unblockPuzzleName`) is a proper noun and
 * stays as-is in every locale; placeholder names match the English source.
 * Shared words (Undo, Hint, Moves, Daily Challenge, …) follow the shell's
 * src/i18n/locales/pt-br.ts.
 */
import type { UnblockPuzzleMessages } from './en';

export const ptBR: UnblockPuzzleMessages = {
  unblockPuzzleName: 'Unblock Puzzle',
  unblockPuzzleChooseBoard: 'Escolha um tabuleiro',
  unblockPuzzleDifficulty_easy: 'Fácil',
  unblockPuzzleDifficulty_medium: 'Médio',
  unblockPuzzleDifficulty_hard: 'Difícil',
  unblockPuzzleRange: '{min}–{max} jogadas',
  unblockPuzzleRangeOpen: '{min} jogadas ou mais',
  unblockPuzzleConfirmSwitchTitle: 'Substituir o tabuleiro em andamento?',
  unblockPuzzleConfirmSwitchBody:
    'Seu tabuleiro {current} será substituído por um novo tabuleiro {next}.',
  unblockPuzzleBoardLabel:
    'Tabuleiro de {cols} por {rows}. A saída fica na ponta direita da linha {row}.',
  unblockPuzzleBlockTarget:
    'Bloco alvo, linha {row}, colunas {from} a {to}. Casas livres: {left} à esquerda, {right} à direita.',
  unblockPuzzleBlockH:
    'Bloco horizontal, linha {row}, colunas {from} a {to}. Casas livres: {left} à esquerda, {right} à direita.',
  unblockPuzzleBlockV:
    'Bloco vertical, coluna {col}, linhas {from} a {to}. Casas livres: {up} acima, {down} abaixo.',
  unblockPuzzleMovesStatus: 'Jogadas {moves} · mínimo {min}',
  unblockPuzzleMoveLeft: 'Mover para a esquerda',
  unblockPuzzleMoveRight: 'Mover para a direita',
  unblockPuzzleMoveUp: 'Mover para cima',
  unblockPuzzleMoveDown: 'Mover para baixo',
  unblockPuzzleSelectPrompt: 'Toque em um bloco para movê-lo',
  unblockPuzzleHintTarget: 'Dica: deslize o bloco alvo para as colunas {toFrom}–{toTo}.',
  unblockPuzzleHintH:
    'Dica: deslize o bloco da linha {row}, colunas {from}–{to}, para as colunas {toFrom}–{toTo}.',
  unblockPuzzleHintV:
    'Dica: deslize o bloco da coluna {col}, linhas {from}–{to}, para as linhas {toFrom}–{toTo}.',
  unblockPuzzleHintShown: 'Deslize o bloco marcado até o contorno tracejado.',
  unblockPuzzleHintNone: 'Nenhuma jogada encontrada a partir daqui.',
  unblockPuzzleSolvedTitle: 'Concluído!',
  unblockPuzzleSolvedBody: 'O bloco alvo saiu.',
  unblockPuzzleSolvedOptimal: 'Saiu com o mínimo de jogadas.',
  unblockPuzzleFewestLabel: 'Mínimo possível',
  unblockPuzzleNetCellsLabel: 'Deslocamento líquido',
  unblockPuzzleHintsUsed: 'Dicas usadas',
  unblockPuzzleNewBestTime: 'Seu melhor tempo no {difficulty}.',
  unblockPuzzleNewBestDailyMoves: 'Seu mínimo de jogadas de hoje.',
  unblockPuzzleNewBoard: 'Novo tabuleiro',
  unblockPuzzleSolvedCount: 'Tabuleiros concluídos',
  unblockPuzzleOptimalCount: 'Concluídos com o mínimo de jogadas',
  unblockPuzzleOverallSection: 'Geral',
  unblockPuzzleDailiesCleared: 'Desafios diários concluídos',
  unblockPuzzleStep1Title: 'Deslize na sua linha',
  unblockPuzzleStep1Body:
    'Cada bloco só desliza na própria linha: de um lado para o outro, ou para cima e para baixo.',
  unblockPuzzleStep2Title: 'Liberte o alvo',
  unblockPuzzleStep2Body:
    'Deslize o bloco alvo para fora pela saída à direita para concluir o tabuleiro.',
  unblockPuzzleStep3Title: 'Um deslize, uma jogada',
  unblockPuzzleStep3Body:
    'Cada deslize conta como uma jogada, não importa a distância, e Desfazer e Dica estão sempre à mão.',
};
