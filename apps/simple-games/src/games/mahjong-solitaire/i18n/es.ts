import type { MahjongMessages } from './en';

export const es: MahjongMessages = {
  mahjongName: 'Mahjong Solitaire',
  mahjongBoardLabel: 'Tablero de mahjong, quedan {n} fichas',
  mahjongTilesLeft: 'Quedan {n} fichas',

  mahjongFaceCharacters: 'Caracteres {n}',
  mahjongFaceDots: 'Círculos {n}',
  mahjongFaceBamboo: 'Bambú {n}',
  mahjongFaceEast: 'Viento del Este',
  mahjongFaceSouth: 'Viento del Sur',
  mahjongFaceWest: 'Viento del Oeste',
  mahjongFaceNorth: 'Viento del Norte',
  mahjongFaceDragonRed: 'Dragón Rojo',
  mahjongFaceDragonGreen: 'Dragón Verde',
  mahjongFaceDragonWhite: 'Dragón Blanco',
  mahjongFaceFlower: 'Flor {n}',
  mahjongFaceSeason: 'Estación {n}',

  mahjongTileFree: '{tile}, se puede tomar',
  mahjongTileBlocked: '{tile}, bloqueada',
  mahjongTileSelected: '{tile}, seleccionada',

  mahjongStuckTitle: 'No hay parejas libres',
  mahjongStuckBody:
    'Deshaz algunos movimientos o reintenta este tablero: ambos son gratis y sin límite.',

  mahjongHintNone: 'Ahora mismo no hay ninguna pareja libre.',

  mahjongClearTitle: '¡Completado!',
  mahjongClearBody: 'Todas las fichas están fuera del tablero.',
  mahjongHintsUsed: 'Pistas usadas',
  mahjongNewBestTime: 'Tu mejor marca.',

  mahjongLevelsCleared: 'Niveles completados',
  mahjongDailiesCleared: 'Diarios completados',
  mahjongDailyBacklogHint: 'Los días anteriores siguen abiertos.',

  mahjongStep1Title: 'Toma parejas iguales',
  mahjongStep1Body:
    'Toca dos fichas con la misma cara para retirarlas. Una ficha se puede tomar cuando nada descansa sobre ella y su lado izquierdo o derecho está libre.',
  mahjongStep2Title: 'Flores y estaciones forman grupos',
  mahjongStep2Body:
    'Cualquier flor empareja con cualquier flor, y cualquier estación con cualquier estación.',
  mahjongStep3Title: 'Vacía el tablero',
  mahjongStep3Body:
    'Todos los tableros se pueden completar. Si no quedan parejas, deshaz o reintenta: ambos son gratis y sin límite.',
};
