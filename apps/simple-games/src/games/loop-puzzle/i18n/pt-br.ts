/**
 * Brazilian Portuguese catalog for Loop Puzzle — written with AI assistance
 * from the English source (provenance `machine`, docs/LOOP_PUZZLE_RULES.md
 * §14). No native speaker has read it; it is not to be treated as reviewed.
 * The title (`loopPuzzleName`) is a proper noun and stays as-is in every
 * locale; placeholder names match the English source. Terms follow the shell
 * (`hint` = Dica) and Box Regions (board = tabuleiro). "Linha" already names a
 * row, so a drawn edge is a traço (never "linha"); an edge is a segmento, the
 * loop a laço.
 */
import type { LoopPuzzleMessages } from './en';

export const ptBR: LoopPuzzleMessages = {
  loopPuzzleName: 'Loop Puzzle',
  loopPuzzleChooseBoard: 'Escolha um tabuleiro',
  loopPuzzleDifficulty_easy: 'Fácil',
  loopPuzzleDifficulty_medium: 'Médio',
  loopPuzzleDifficulty_hard: 'Difícil',
  loopPuzzleBoardNote: '{width}×{height}',
  loopPuzzleConfirmSwitchTitle: 'Substituir o tabuleiro em andamento?',
  loopPuzzleConfirmSwitchBody:
    'Sua partida {current} será substituída por um novo tabuleiro {next}.',
  loopPuzzleBoardLabel: 'Tabuleiro de Loop Puzzle, {width} por {height}',
  loopPuzzleEdgeHEmpty: 'Segmento horizontal, linha {row}, coluna {col}, vazio',
  loopPuzzleEdgeHLine: 'Segmento horizontal, linha {row}, coluna {col}, com traço',
  loopPuzzleEdgeHCross: 'Segmento horizontal, linha {row}, coluna {col}, marcado com ×',
  loopPuzzleEdgeVEmpty: 'Segmento vertical, linha {row}, coluna {col}, vazio',
  loopPuzzleEdgeVLine: 'Segmento vertical, linha {row}, coluna {col}, com traço',
  loopPuzzleEdgeVCross: 'Segmento vertical, linha {row}, coluna {col}, marcado com ×',
  loopPuzzleClueOpen: 'Número {n}, linha {row}, coluna {col}',
  loopPuzzleClueMet: 'Número {n}, linha {row}, coluna {col}, cumprido',
  loopPuzzleClueTooMany: 'Número {n}, linha {row}, coluna {col}, traços demais',
  loopPuzzleClueTooFew: 'Número {n}, linha {row}, coluna {col}, não dá mais para cumprir',
  loopPuzzleNoteHint: 'Marcado pela dica',
  loopPuzzleNoteConflict: 'Quebra uma regra',
  loopPuzzleConflictBranch: 'Um ponto tem mais de dois traços.',
  loopPuzzleConflictDeadEnd: 'Um traço termina num ponto sem saída.',
  loopPuzzleConflictLoop: 'Um laço fechado deixa outros traços de fora.',
  loopPuzzleConflictTooMany: 'Um número tem mais traços do que indica.',
  loopPuzzleConflictTooFew: 'Um número não consegue mais ter traços suficientes.',
  loopPuzzleConflictClosed: 'O laço está fechado, mas um número não confere.',
  loopPuzzleHintWrongLine: 'O traço marcado não faz parte do laço.',
  loopPuzzleHintWrongCross: 'O laço passa pelo × marcado.',
  loopPuzzleHintCellLine: 'O número circulado precisa de um traço no segmento marcado.',
  loopPuzzleHintCellCross: 'O número circulado não admite traço no segmento marcado.',
  loopPuzzleHintDotLine: 'No ponto circulado, o laço precisa usar o segmento marcado.',
  loopPuzzleHintDotCross: 'No ponto circulado, o segmento marcado não pode ter traço.',
  loopPuzzleHintLoopCross: 'Um traço no segmento marcado fecharia um laço cedo demais.',
  loopPuzzleHintClosedCross: 'O laço está fechado, então o segmento marcado não faz parte dele.',
  loopPuzzleHintTrialLine: 'Sem um traço no segmento marcado, chega-se a uma contradição.',
  loopPuzzleHintTrialCross: 'Um traço no segmento marcado leva a uma contradição.',
  loopPuzzleHintRevealLine: 'O segmento marcado faz parte do laço.',
  loopPuzzleHintRevealCross: 'O segmento marcado não faz parte do laço.',
  loopPuzzleHintNone: 'Nenhuma dica por enquanto.',
  loopPuzzleSolvedTitle: 'Resolvido!',
  loopPuzzleSolvedBody: 'Um único laço fechado, todos os números cumpridos.',
  loopPuzzleHintsUsed: 'Dicas usadas',
  loopPuzzleNewBestTime: 'Seu mais rápido até agora.',
  loopPuzzleNewBoard: 'Novo tabuleiro',
  loopPuzzleSolvedCount: 'Quebra-cabeças resolvidos',
  loopPuzzleDailySection: 'Diário',
  loopPuzzleDailiesCleared: 'Dias concluídos',
  loopPuzzleAllBoards: 'Todos os tabuleiros',
  loopPuzzleStep1Title: 'Um único laço fechado',
  loopPuzzleStep1Body:
    'Ligue os pontos em um único laço fechado, sem ramificações nem cruzamentos.',
  loopPuzzleStep2Title: 'Leia os números',
  loopPuzzleStep2Body: 'Um número diz quantos dos seus quatro lados o laço usa.',
  loopPuzzleStep3Title: 'Toque num segmento',
  loopPuzzleStep3Body:
    'Cada toque muda o segmento para traço, depois para × (fora do laço) e depois para vazio.',
};
