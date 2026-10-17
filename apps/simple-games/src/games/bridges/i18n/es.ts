/**
 * Spanish catalog for Bridges. Provenance (docs/BRIDGES_RULES.md §14,
 * docs/I18N_POLICY.md): `machine` — written with AI assistance and **not read
 * by a native speaker**. Neutral Latin-American-leaning Spanish, like the
 * shell. The title (`bridgesName`) is a proper noun and stays as-is in every
 * locale; placeholder names match the English source.
 */
import type { BridgesMessages } from './en';

export const es: BridgesMessages = {
  bridgesName: 'Bridges',
  bridgesChooseBoard: 'Elige un tablero',
  bridgesDifficulty_easy: 'Fácil',
  bridgesDifficulty_medium: 'Medio',
  bridgesDifficulty_hard: 'Difícil',
  bridgesBoardNote: '{width}×{height}',
  bridgesConfirmSwitchTitle: '¿Reemplazar el tablero en curso?',
  bridgesConfirmSwitchBody: 'Tu tablero {current} se reemplazará por un tablero {next} nuevo.',
  bridgesBoardLabel: 'Tablero de Bridges, {width} por {height}, {islands} islas',
  bridgesIslandOpen: 'Isla {value}, fila {row}, columna {col}: {count} de {value} puentes',
  bridgesIslandComplete: 'Isla {value}, fila {row}, columna {col}: completa',
  bridgesIslandOver: 'Isla {value}, fila {row}, columna {col}: {count} puentes, demasiados',
  bridgesIslandSelected: '{island}. Seleccionada',
  bridgesIslandPartner: '{island}. Se puede unir a la isla seleccionada: {bridges} de 2 puentes',
  bridgesIslandHinted: '{island}. Resaltada por la pista',
  bridgesIslandHintRing: '{island}. Resaltada por la pista, en el círculo punteado',
  bridgesAnnounceNone:
    'Ningún puente entre la fila {row1}, columna {col1} y la fila {row2}, columna {col2}',
  bridgesAnnounceOne:
    'Un puente entre la fila {row1}, columna {col1} y la fila {row2}, columna {col2}',
  bridgesAnnounceTwo:
    'Dos puentes entre la fila {row1}, columna {col1} y la fila {row2}, columna {col2}',
  bridgesSplitNote:
    'Todos los números se cumplen, pero las islas forman {groups} grupos. Únelas en uno solo.',
  bridgesHintWrong: 'Sobran puentes entre las islas resaltadas.',
  bridgesHintOne: 'La pareja resaltada necesita al menos un puente.',
  bridgesHintTwo: 'La pareja resaltada necesita dos puentes.',
  bridgesHintOneAt:
    'Haz la cuenta en la isla del círculo punteado: la pareja resaltada necesita al menos un puente.',
  bridgesHintTwoAt:
    'Haz la cuenta en la isla del círculo punteado: la pareja resaltada necesita dos puentes.',
  bridgesHintNone: 'No hay ninguna jugada segura desde aquí.',
  bridgesHintWhere: 'Resaltadas: fila {row1}, columna {col1} y fila {row2}, columna {col2}.',
  bridgesHintWhereRing:
    'Resaltadas: fila {row1}, columna {col1} y fila {row2}, columna {col2}. Círculo punteado: fila {row}, columna {col}.',
  bridgesSolvedTitle: '¡Todo conectado!',
  bridgesSolvedBody: 'Todas las islas forman una sola red.',
  bridgesHintsUsed: 'Pistas usadas',
  bridgesNewBestTime: 'Tu tiempo más rápido.',
  bridgesNewBoard: 'Tablero nuevo',
  bridgesSolvedCount: 'Tableros resueltos',
  bridgesDailySection: 'Diario',
  bridgesDailiesCleared: 'Días completados',
  bridgesAllModes: 'Todos los modos',
  bridgesStep1Title: 'Los números son puentes',
  bridgesStep1Body: 'Cada isla lleva exactamente tantos puentes como indica su número.',
  bridgesStep2Title: 'Rectos, dos como máximo',
  bridgesStep2Body:
    'Los puentes van rectos en horizontal o vertical, nunca se cruzan y como máximo dos unen la misma pareja.',
  bridgesStep3Title: 'Únelas todas',
  bridgesStep3Body:
    'Toca una isla y luego una compañera con anillo para añadir un puente (otra vez para dos, otra más para ninguno), hasta unir todas las islas.',
};
