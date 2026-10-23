/** AI-authored translation draft; no human review claimed. See docs/KNIGHT_TOUR_RULES.md. */
import type { KnightTourMessages } from './en';
export const de: KnightTourMessages = {
  knightTourName: 'Knight’s Tour',
  knightTourVisited: 'Besucht: {count} / {total}',
  knightTourBoard: 'Brett',
  knightTourCurrent: 'Springer, aktuelles Feld',
  knightTourVisitNumber: 'Besuch {count}',
  knightTourLegal: 'Erlaubtes Ziel',
  knightTourEmpty: 'Unbesucht',
  knightTourCell: 'Reihe {row}, Spalte {col}: {content}',
  knightTourPaused: 'Pausiert. Spiele weiter, wenn du bereit bist.',
  knightTourStuck: 'Kein Zug möglich. Gehe zurück und probiere einen anderen Weg.',
  knightTourInstruction: 'Ziehe in L-Form auf ein Feld mit Punkt.',
  knightTourNewBoard: 'Neues Brett',
  knightTourWon: 'Tour geschafft!',
  knightTourWins: 'Abgeschlossen',
  knightTourStep1Title: 'In L-Form ziehen',
  knightTourStep1Body:
    'Der Springer zieht zwei Felder in eine Richtung und eines zur Seite. Punkte zeigen erlaubte Ziele.',
  knightTourStep2Title: 'Jedes Feld einmal besuchen',
  knightTourStep2Body:
    'Jedes besuchte Feld erhält eine Nummer und darf nicht erneut betreten werden.',
  knightTourStep3Title: 'In deinem Tempo erkunden',
  knightTourStep3Body:
    'Besuche alle Felder. Wenn du feststeckst, gehe zurück und probiere einen anderen Weg.',
};
