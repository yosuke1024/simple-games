// AI translation; not reviewed by a native speaker.
import type { ChainTerritoryMessages } from './en';
export const es: ChainTerritoryMessages = {
  chainTerritoryName: 'Chain Territory',
  chainTerritoryBest: 'Menos jugadas para ganar',
  chainTerritoryWins: 'Victorias',
  chainTerritoryWon: '¡Ganaste!',
  chainTerritoryLost: 'Gana la CPU',
  chainTerritoryYou: 'Tú',
  chainTerritoryCpu: 'CPU',
  chainTerritoryEmpty: 'Vacía',
  chainTerritoryField: 'Tablero de reacción en cadena',
  chainTerritoryCell: 'Fila {row}, columna {col}: {owner}, {n} de {max}',
  chainTerritoryTurn: 'Pon una esfera en una casilla vacía o tuya.',
  chainTerritoryThinking: 'La CPU está pensando…',
  chainTerritoryChain: 'La reacción se extiende…',
  chainTerritoryCapacity: 'Esquinas: 2 · Bordes: 3 · Interior: 4',
  chainTerritoryStep1Title: 'Coloca una esfera',
  chainTerritoryStep1Body:
    'Juega por turnos con la CPU. Añade una esfera a una casilla vacía o tuya.',
  chainTerritoryStep2Title: 'Inicia una cadena',
  chainTerritoryStep2Body:
    'Con 2 en una esquina, 3 en un borde o 4 dentro, las esferas pasan a las casillas vecinas y las capturan.',
  chainTerritoryStep3Title: 'Captura todas las esferas rivales',
  chainTerritoryStep3Body:
    'Tras la primera jugada de ambos, captura todas las esferas de la CPU para ganar. Deshacer revierte tu jugada y su respuesta.',
  chainTerritoryMode_easy: 'Fácil',
  chainTerritoryMode_normal: 'Normal',
  chainTerritoryMode_hard: 'Difícil',
};
