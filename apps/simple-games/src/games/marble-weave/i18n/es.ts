// AI translation; not reviewed by a native speaker.
import type { MarbleWeaveMessages } from './en';
export const es: MarbleWeaveMessages = {
  marbleWeaveName: 'Marble Weave',
  marbleWeaveBest: 'Mayor puntuación',
  marbleWeaveFinished: 'Partidas terminadas',
  marbleWeaveLost: 'Tu resultado',
  marbleWeaveField: 'Tablero de canicas',
  marbleWeaveEmpty: 'Vacía',
  marbleWeaveCell: 'Fila {row}, columna {col}: {color}',
  marbleWeaveNext: 'Próximas',
  marbleWeaveTarget: 'Línea de {n}',
  marbleWeaveSelect: 'Elige una canica.',
  marbleWeaveDestination: 'Elige una casilla con punto. No puedes atravesar otras canicas.',
  marbleWeaveBlocked: 'No hay camino libre. Elige otra casilla o canica.',
  marbleWeaveMoving: 'Siguiendo el camino libre…',
  marbleWeaveColor1: 'Círculo rojo',
  marbleWeaveColor2: 'Rombo azul',
  marbleWeaveColor3: 'Cruz verde',
  marbleWeaveColor4: 'Triángulo dorado',
  marbleWeaveColor5: 'Estrella morada',
  marbleWeaveColor6: 'Cuadrado turquesa',
  marbleWeaveColor7: 'Flor rosa',
  marbleWeaveStep1Title: 'Busca un camino',
  marbleWeaveStep1Body:
    'Elige una canica y luego una casilla con punto. Se mueve por casillas vacías, nunca en diagonal.',
  marbleWeaveStep2Title: 'Forma una línea',
  marbleWeaveStep2Body:
    'Alinea 4 del mismo color en Fácil, o 5 en Normal y Difícil. Cuentan filas, columnas y diagonales.',
  marbleWeaveStep3Title: 'Deja espacio',
  marbleWeaveStep3Body:
    'Si no formas una línea, aparecen las 3 canicas anunciadas. Deshacer revierte toda la jugada, incluidas las nuevas canicas.',
  marbleWeaveMode_easy: 'Fácil',
  marbleWeaveMode_normal: 'Normal',
  marbleWeaveMode_hard: 'Difícil',
};
