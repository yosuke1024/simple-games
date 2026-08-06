import type { Game2048Messages } from './en';

export const es: Game2048Messages = {
  mergeName: '2048',
  mergeBoardLabel: 'Tablero de 2048, 4 por 4',
  mergeCell: 'Fila {row}, columna {col}: {value}',
  mergeCellEmpty: 'Fila {row}, columna {col}: vacía',
  mergeBestScore: 'Mejor puntuación',
  mergeBestTile: 'Ficha más alta',
  mergeReachedCount: 'Veces que llegaste a 2048',
  mergeReachedTitle: '¡Llegaste a 2048!',
  mergeReachedBody: 'Sigue jugando: el tablero aún está abierto.',
  mergeKeepGoing: 'Seguir',
  mergeOverTitle: 'No quedan movimientos',
  mergeOverBody: 'Todas las casillas están llenas y no queda nada por unir.',
  mergeNewBestScore: 'Tu mejor puntuación hasta ahora.',
  mergeStep1Title: 'Desliza para mover',
  mergeStep1Body: 'Todas las fichas se desplazan a la vez, y dos números iguales se unen en uno.',
  mergeStep2Title: 'Aparece una ficha nueva',
  mergeStep2Body: 'Se añade una ficha tras cada movimiento que cambia el tablero.',
  mergeStep3Title: '¿Atascado? Da marcha atrás',
  mergeStep3Body:
    'Deshacer es gratis e ilimitado, y nunca vuelve a sortear la ficha que acabas de recibir.',
};
