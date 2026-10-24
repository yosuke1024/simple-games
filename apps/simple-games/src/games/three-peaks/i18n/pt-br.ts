/** AI-written draft; no human or native review. */
import type { ThreePeaksMessages } from './en';
export const ptBR: ThreePeaksMessages = {
  threePeaksName: 'Three Peaks',
  threePeaksStep1Title: 'Limpe os três picos',
  threePeaksStep1Body:
    'Retire cartas descobertas com valor um acima ou abaixo do descarte para limpar os três picos.',
  threePeaksStep2Title: 'O ás liga as duas pontas',
  threePeaksStep2Body: 'K–A–2 funciona nos dois sentidos. O naipe não importa.',
  threePeaksStep3Title: 'Compre ou desfaça',
  threePeaksStep3Body:
    'Compre um novo descarte quando precisar. O monte só é usado uma vez. Qualquer jogada pode ser desfeita, mesmo após o fim.',
  threePeaksDraw: 'Comprar',
  threePeaksStock: 'Monte',
  threePeaksWaste: 'Descarte',
  threePeaksDrawCount: 'Comprar carta; restam {count}',
  threePeaksCardsLeft: 'Cartas restantes',
  threePeaksWon: 'Todos os picos limpos!',
  threePeaksStuck: 'Sem jogadas',
  threePeaksStuckBody:
    'O monte acabou e nenhuma carta descoberta combina. Desfaça para tentar outro caminho.',
  threePeaksUndoHint: 'Desfaça sem limite, incluindo compras e partidas encerradas.',
  threePeaksWins: 'Vitórias',
  threePeaksBest: 'Menos cartas restantes',
  threePeaksBoard: 'Tabuleiro de três picos',
  threePeaksCovered: 'Carta {position}, virada para baixo',
  threePeaksCardLabel: 'Carta {position}: {rank} de {suit}, {state}',
  threePeaksCanMove: 'pode mover',
  threePeaksCannotMove: 'não pode mover',
  threePeaksSpades: 'espadas',
  threePeaksHearts: 'copas',
  threePeaksDiamonds: 'ouros',
  threePeaksClubs: 'paus',
  threePeaksKeyboard: 'Setas: selecionar carta · D: comprar · Ctrl/Cmd+Z: desfazer',
};
