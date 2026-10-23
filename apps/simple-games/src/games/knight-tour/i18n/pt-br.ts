/** AI-authored translation draft; no human review claimed. See docs/KNIGHT_TOUR_RULES.md. */
import type { KnightTourMessages } from './en';
export const ptBR: KnightTourMessages = {
  knightTourName: 'Knight’s Tour',
  knightTourVisited: 'Visitadas: {count} / {total}',
  knightTourBoard: 'Tabuleiro',
  knightTourCurrent: 'Cavalo, casa atual',
  knightTourVisitNumber: 'Visita {count}',
  knightTourLegal: 'Destino válido',
  knightTourEmpty: 'Não visitada',
  knightTourCell: 'Linha {row}, coluna {col}: {content}',
  knightTourPaused: 'Pausado. Continue quando quiser.',
  knightTourStuck: 'Sem movimentos. Desfaça para tentar outra rota.',
  knightTourInstruction: 'Mova em L até uma casa com ponto.',
  knightTourNewBoard: 'Novo tabuleiro',
  knightTourWon: 'Passeio completo!',
  knightTourWins: 'Concluídos',
  knightTourStep1Title: 'Mova em L',
  knightTourStep1Body:
    'O cavalo anda duas casas em uma direção e uma para o lado; os pontos mostram destinos válidos.',
  knightTourStep2Title: 'Visite cada casa uma vez',
  knightTourStep2Body: 'Cada casa visitada recebe um número e não pode ser usada novamente.',
  knightTourStep3Title: 'Explore no seu ritmo',
  knightTourStep3Body:
    'Visite todas as casas para concluir. Se ficar sem saída, desfaça e tente outra rota.',
};
