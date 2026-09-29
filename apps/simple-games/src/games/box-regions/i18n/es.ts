/**
 * Spanish catalog for Box Regions — machine translation of the English
 * source, unreviewed (docs/I18N_POLICY.md: provenance `machine`). The title
 * (`boxRegionsName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source.
 */
import type { BoxRegionsMessages } from './en';

export const es: BoxRegionsMessages = {
  boxRegionsName: 'Box Regions',
  boxRegionsChooseBoard: 'Elige un tablero',
  boxRegionsDifficulty_easy: 'Fácil',
  boxRegionsDifficulty_medium: 'Medio',
  boxRegionsDifficulty_hard: 'Difícil',
  boxRegionsBoardNote: '{width}×{height}',
  boxRegionsConfirmSwitchTitle: '¿Reemplazar el tablero en curso?',
  boxRegionsConfirmSwitchBody: 'Tu partida {current} se reemplazará por un tablero {next} nuevo.',
  boxRegionsBoardLabel: 'Tablero de Box Regions, {width} por {height}',
  boxRegionsCellAssigned: 'Fila {row}, columna {col}, caja {region}',
  boxRegionsCellEmpty: 'Fila {row}, columna {col}, sin asignar',
  boxRegionsClueCount: '{count} de {size} casillas',
  boxRegionsRuleBroken: 'incumple una regla',
  boxRegionsKind_square: 'Cuadrada',
  boxRegionsKind_tall: 'Alta',
  boxRegionsKind_wide: 'Ancha',
  boxRegionsKind_free: 'Cualquier caja',
  boxRegionsHintWrong: 'La caja resaltada no coincide con la solución.',
  boxRegionsHintForced: 'La casilla marcada solo puede pertenecer a la caja de la pista resaltada.',
  boxRegionsHintSole: 'Esta caja solo se puede dibujar de una manera.',
  boxRegionsHintCommon:
    'Se dibuje como se dibuje la caja de esta pista, cubre las casillas marcadas.',
  boxRegionsHintNone: 'Ahora mismo no hay ninguna jugada segura.',
  boxRegionsSolvedTitle: '¡Resuelto!',
  boxRegionsSolvedBody: 'Cada casilla está en su caja.',
  boxRegionsHintsUsed: 'Ayudas usadas',
  boxRegionsNewBestTime: 'Tu mejor tiempo.',
  boxRegionsNewBoard: 'Tablero nuevo',
  boxRegionsSolvedCount: 'Puzles resueltos',
  boxRegionsDailySection: 'Diario',
  boxRegionsDailiesCleared: 'Días completados',
  boxRegionsDailyBacklogHint: 'Todos los días anteriores siguen abiertos.',
  boxRegionsStep1Title: 'Divide en cajas',
  boxRegionsStep1Body: 'Divide el tablero en rectángulos, cada uno con exactamente una pista.',
  boxRegionsStep2Title: 'Lee las pistas',
  boxRegionsStep2Body:
    'El número indica cuántas casillas tiene la caja; el símbolo indica si es cuadrada, alta, ancha o cualquiera.',
  boxRegionsStep3Title: 'Dibuja de esquina a esquina',
  boxRegionsStep3Body:
    'Arrastra de una esquina a la opuesta para dibujar una caja. Toca una caja para quitarla. ¿Atascado? Prueba una ayuda.',
};
