/** AI-authored translation draft; no human review claimed. See docs/KNIGHT_TOUR_RULES.md. */
import type { KnightTourMessages } from './en';
export const es: KnightTourMessages = {
  knightTourName: 'Knight’s Tour',
  knightTourVisited: 'Visitadas: {count} / {total}',
  knightTourBoard: 'Tablero',
  knightTourCurrent: 'Caballo, casilla actual',
  knightTourVisitNumber: 'Visita {count}',
  knightTourLegal: 'Destino válido',
  knightTourEmpty: 'Sin visitar',
  knightTourCell: 'Fila {row}, columna {col}: {content}',
  knightTourPaused: 'En pausa. Continúa cuando quieras.',
  knightTourStuck: 'No quedan movimientos. Deshaz para probar otra ruta.',
  knightTourInstruction: 'Muévete en L a una casilla con punto.',
  knightTourNewBoard: 'Nuevo tablero',
  knightTourWon: '¡Recorrido completo!',
  knightTourWins: 'Completados',
  knightTourStep1Title: 'Muévete en L',
  knightTourStep1Body:
    'El caballo avanza dos casillas en una dirección y una de lado; los puntos indican destinos válidos.',
  knightTourStep2Title: 'Visita cada casilla una vez',
  knightTourStep2Body: 'Cada casilla visitada recibe un número y no se puede volver a usar.',
  knightTourStep3Title: 'Explora a tu ritmo',
  knightTourStep3Body:
    'Visita todas las casillas para terminar. Si te atascas, deshaz y prueba otra ruta.',
};
