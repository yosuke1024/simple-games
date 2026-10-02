/**
 * Spanish catalog for Shape Regions (docs/I18N_POLICY.md: provenance
 * `machine`). The title (`shapeRegionsName`) is a proper noun and stays
 * as-is in every locale; placeholder names match the English source.
 */
import type { ShapeRegionsMessages } from './en';

export const es: ShapeRegionsMessages = {
  shapeRegionsName: 'Shape Regions',
  shapeRegionsChooseBoard: 'Elige un tablero',
  shapeRegionsDifficulty_easy: 'Fácil',
  shapeRegionsDifficulty_medium: 'Medio',
  shapeRegionsDifficulty_hard: 'Difícil',
  shapeRegionsBoardNote: '{width}×{height}',
  shapeRegionsConfirmSwitchTitle: '¿Reemplazar el tablero en curso?',
  shapeRegionsConfirmSwitchBody: 'Tu partida {current} se reemplazará por un nuevo tablero {next}.',
  shapeRegionsBoardLabel: 'Tablero de Shape Regions, {width} por {height}',
  shapeRegionsCellAssigned: 'Fila {row}, columna {col}, figura {region}',
  shapeRegionsCellEmpty: 'Fila {row}, columna {col}, sin asignar',
  shapeRegionsClueCount: '{count} de {size} celdas',
  shapeRegionsRuleBroken: 'rompe una regla',
  shapeRegionsShape_line: 'Línea',
  shapeRegionsShape_block: 'Rectángulo',
  shapeRegionsShape_corner: 'Esquina',
  shapeRegionsShape_tee: 'Forma de T',
  shapeRegionsShape_step: 'Escalón',
  shapeRegionsHintWrong: 'La figura resaltada no coincide con la solución.',
  shapeRegionsHintForced: 'La celda marcada solo puede pertenecer a la figura resaltada.',
  shapeRegionsHintSole: 'La figura resaltada solo puede colocarse de una manera.',
  shapeRegionsHintCommon:
    'Se coloque como se coloque la figura resaltada, incluye las celdas marcadas.',
  shapeRegionsHintNone: 'No se encontró un movimiento seguro por ahora.',
  shapeRegionsSolvedTitle: '¡Resuelto!',
  shapeRegionsSolvedBody: 'Cada celda pertenece a su figura.',
  shapeRegionsHintsUsed: 'Pistas usadas',
  shapeRegionsNewBestTime: 'Tu mejor tiempo.',
  shapeRegionsNewBoard: 'Nuevo tablero',
  shapeRegionsSolvedCount: 'Puzles resueltos',
  shapeRegionsDailySection: 'Diario',
  shapeRegionsDailiesCleared: 'Días completados',
  shapeRegionsStep1Title: 'Número y símbolo',
  shapeRegionsStep1Body: 'El número dice cuántas celdas tiene la figura; el símbolo, su forma.',
  shapeRegionsStep2Title: 'Crece desde la pista',
  shapeRegionsStep2Body:
    'Arrastra desde una pista por las celdas vecinas para hacer crecer su figura.',
  shapeRegionsStep3Title: 'Llena el tablero',
  shapeRegionsStep3Body:
    'Al terminar, cada celda pertenece a una figura. Toca una celda para quitarla.',
};
