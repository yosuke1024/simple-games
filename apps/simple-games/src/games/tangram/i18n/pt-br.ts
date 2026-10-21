/**
 * Tangram — the Brazilian Portuguese catalog. Provenance
 * (docs/TANGRAM_RULES.md §11): `machine` — written by an AI from the English
 * source on 2026-10-21; nobody has read it, native speaker or author. The
 * title (`tangramName`) stays "Tangram".
 *
 * Terms: silhueta, figura, peça, bandeja (tray), tabuleiro (board). Every
 * piece name is masculine (triângulo, paralelogramo, quadrado), so the
 * participles agree with all of them. "Flip" is Espelhar / espelhado, since
 * "virar" also means "to turn". Tiers and the daily follow the puzzle shelf.
 */
import type { TangramMessages } from './en';

export const ptBR: TangramMessages = {
  tangramName: 'Tangram',

  tangramTier_easy: 'Fácil',
  tangramTier_medium: 'Médio',
  tangramTier_hard: 'Difícil',
  tangramFigureName: '{tier} {number}',
  tangramDailyName: 'Desafio diário, {date}',
  tangramSilhouetteLabel: 'Silhueta: {figure}',

  tangramConfirmReplaceTitle: 'Substituir a figura em andamento?',
  tangramConfirmReplaceBody: 'A figura {current} será substituída por {next}.',

  tangramPiece_L1: 'Triângulo grande 1',
  tangramPiece_L2: 'Triângulo grande 2',
  tangramPiece_M: 'Triângulo médio',
  tangramPiece_P: 'Paralelogramo',
  tangramPiece_SQ: 'Quadrado',
  tangramPiece_S1: 'Triângulo pequeno 1',
  tangramPiece_S2: 'Triângulo pequeno 2',
  tangramPieceInTray: '{piece}, girado {angle}°, na bandeja',
  tangramPieceInTrayFlipped: '{piece}, girado {angle}°, espelhado, na bandeja',
  tangramPieceOnBoard: '{piece}, girado {angle}°, no tabuleiro',
  tangramPieceOnBoardFlipped: '{piece}, girado {angle}°, espelhado, no tabuleiro',
  tangramPieceFixed: '{piece}, girado {angle}°, fixo no lugar',
  tangramPieceFixedFlipped: '{piece}, girado {angle}°, espelhado, fixo no lugar',

  tangramRotate: 'Girar',
  tangramFlip: 'Espelhar',

  tangramLifted: '{piece} levantado. As setas o movem, Enter o coloca e Esc o devolve à bandeja.',
  tangramFitsOutlineVertex: 'Encaixa em um canto da silhueta',
  tangramFitsOutlineEdge: 'Encaixa em uma borda da silhueta',
  tangramFitsPieceVertex: 'Encaixa em um canto de outra peça',
  tangramFitsPieceEdge: 'Encaixa em uma borda de outra peça',
  tangramNoFit: 'Não encaixa aqui',

  tangramStep1Title: 'Arraste e gire',
  tangramStep1Body:
    'Arraste uma peça até a silhueta para colocá-la e toque nela para girá-la (Espelhar espelha o paralelogramo).',
  tangramStep2Title: 'Dentro, nunca por cima',
  tangramStep2Body: 'Uma peça só encaixa dentro da silhueta, e nunca sobre outra peça.',
  tangramStep3Title: 'Preencha',
  tangramStep3Body: 'Quando as sete peças preenchem a silhueta exatamente, a figura está completa.',

  tangramResultTitle: 'Figura completa',
  tangramNextFigure: 'Próxima figura',
  tangramTierLabel: 'Nível',
  tangramFigureLabel: 'Figura',

  tangramStatStarted: 'Figuras iniciadas',
  tangramStatCompleted: 'Figuras concluídas',
  tangramStatDifferent: 'Figuras diferentes concluídas',
  tangramStatDays: 'Dias concluídos',
  tangramStatsAll: 'Todas as partidas',
};
