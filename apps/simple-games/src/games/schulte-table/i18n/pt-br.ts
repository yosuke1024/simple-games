import type { SchulteMessages } from './en';

export const ptBR: SchulteMessages = {
  schulteName: 'Schulte Table',

  schulteBoardLabel: 'Tabuleiro de números',
  schulteCell: '{value}, linha {row}, coluna {col}',
  schulteCellDone: '{value}, linha {row}, coluna {col}, já tocado',
  schulteFind: 'Procure',

  schulteDoneTitle: 'Todos encontrados',
  schulteDoneBody: 'Você tocou em todos os números em ordem.',
  schulteMisses: 'Toques errados',
  schulteNewBestTime: 'Seu tempo mais rápido.',
  schulteConfirmRestartBody: 'Esta rodada recomeça do primeiro número.',

  schulteDailyBacklogHint: 'Os dias anteriores ficam sempre abertos.',
  schulteSizeLabel: '{n}x{n}',
  schulteLevelsDone: 'Níveis concluídos',
  schulteDailiesDone: 'Diários concluídos',
  schulteTotalMisses: 'Total de toques errados',

  schulteStep1Title: 'Toque em 1, depois 2, depois 3',
  schulteStep1Body: 'Os números estão espalhados. Toque neles em ordem.',
  schulteStep2Title: 'O número a procurar fica acima do tabuleiro',
  schulteStep2Body: 'Um toque errado não custa nada. O tabuleiro apenas espera.',
  schulteStep3Title: 'Termine o tabuleiro',
  schulteStep3Body: 'Seu tempo é registrado. Não há limite de tempo.',
};
