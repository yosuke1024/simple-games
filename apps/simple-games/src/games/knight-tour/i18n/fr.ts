/** AI-authored translation draft; no human review claimed. See docs/KNIGHT_TOUR_RULES.md. */
import type { KnightTourMessages } from './en';
export const fr: KnightTourMessages = {
  knightTourName: 'Knight’s Tour',
  knightTourVisited: 'Visitées : {count} / {total}',
  knightTourBoard: 'Plateau',
  knightTourCurrent: 'Cavalier, case actuelle',
  knightTourVisitNumber: 'Visite {count}',
  knightTourLegal: 'Destination autorisée',
  knightTourEmpty: 'Non visitée',
  knightTourCell: 'Ligne {row}, colonne {col} : {content}',
  knightTourPaused: 'En pause. Reprenez à votre rythme.',
  knightTourStuck: 'Plus de coups. Annulez pour essayer un autre chemin.',
  knightTourInstruction: 'Déplacez-vous en L vers une case à point.',
  knightTourNewBoard: 'Nouveau plateau',
  knightTourWon: 'Parcours terminé !',
  knightTourWins: 'Terminés',
  knightTourStep1Title: 'Déplacez-vous en L',
  knightTourStep1Body:
    'Le cavalier avance de deux cases dans une direction puis d’une sur le côté ; les points indiquent les destinations possibles.',
  knightTourStep2Title: 'Chaque case une seule fois',
  knightTourStep2Body:
    'Chaque arrivée reçoit un numéro ; une case visitée ne peut plus être utilisée.',
  knightTourStep3Title: 'Explorez à votre rythme',
  knightTourStep3Body:
    'Visitez toutes les cases pour finir. Si vous êtes bloqué, annulez pour essayer un autre chemin.',
};
