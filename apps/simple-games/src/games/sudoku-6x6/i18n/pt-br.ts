/**
 * Brazilian Portuguese catalog for Sudoku 6×6 — a machine translation of the English
 * source, not yet reviewed (docs/I18N_POLICY.md). The title
 * (`sudoku6x6Name`) is a proper noun. Wording follows the 9×9 Sudoku
 * catalog wherever the meaning is the same.
 */
import type { Sudoku6x6Messages } from './en';

export const ptBR: Sudoku6x6Messages = {
  sudoku6x6Name: 'Sudoku 6×6',
  sudoku6x6ChooseBoard: 'Escolha um tabuleiro',
  sudoku6x6Difficulty_easy: 'Fácil',
  sudoku6x6Difficulty_medium: 'Médio',
  sudoku6x6Difficulty_hard: 'Difícil',
  sudoku6x6ConfirmSwitchTitle: 'Substituir o tabuleiro em andamento?',
  sudoku6x6ConfirmSwitchBody: 'Seu jogo {current} será substituído por um novo tabuleiro {next}.',
  sudoku6x6GridLabel: 'Grade do Sudoku 6×6',
  sudoku6x6PadLabel: 'Teclado numérico',
  sudoku6x6PadKey: '{value}, restam {n}',
  sudoku6x6PadNoteKey: 'Nota {value}',
  sudoku6x6CellEmpty: 'Vazia, linha {row}, coluna {col}',
  sudoku6x6CellGiven: '{value}, inicial, linha {row}, coluna {col}',
  sudoku6x6CellEntry: '{value}, linha {row}, coluna {col}',
  sudoku6x6Erase: 'Apagar',
  sudoku6x6Notes: 'Notas',
  sudoku6x6HintOnlyDigit: 'Só um número cabe nesta casa.',
  sudoku6x6HintOnlyCell: 'Aqui {value} só cabe nesta casa.',
  sudoku6x6HintLockedLine: 'Neste bloco, {value} só cabe na linha destacada.',
  sudoku6x6HintLockedBox: 'Nesta linha, {value} só cabe no bloco destacado.',
  sudoku6x6HintRuledOut: 'Estas casas eliminam esses números no resto do grupo.',
  sudoku6x6HintNone: 'Ainda não dá para deduzir nada.',
  sudoku6x6SolvedTitle: 'Resolvido!',
  sudoku6x6SolvedBody: 'Cada linha, coluna e bloco contém 1-6.',
  sudoku6x6Mistakes: 'Erros',
  sudoku6x6HintsUsed: 'Dicas usadas',
  sudoku6x6NewBestTime: 'Seu tempo mais rápido.',
  sudoku6x6NewBoard: 'Novo tabuleiro',
  sudoku6x6DailySection: 'Diário',
  sudoku6x6DailiesSolved: 'Dias resolvidos',
  sudoku6x6DailyBacklogHint: 'Todos os dias anteriores continuam abertos.',
  sudoku6x6HighlightMistakes: 'Mostrar erros',
  sudoku6x6HighlightMistakesNote:
    'Marca um número errado assim que ele é colocado. Repetidos são sempre marcados.',
  sudoku6x6Step1Title: '1-6, um de cada',
  sudoku6x6Step1Body: 'Cada linha, coluna e bloco 2×3 contém de 1 a 6 exatamente uma vez.',
  sudoku6x6Step2Title: 'Preencha e anote',
  sudoku6x6Step2Body: 'Escolha uma casa e toque em um número. Ative Notas para anotar candidatos.',
  sudoku6x6Step3Title: 'Travou? Peça uma dica',
  sudoku6x6Step3Body: 'A dica mostra a próxima casa de que você pode ter certeza, e por quê.',
};
