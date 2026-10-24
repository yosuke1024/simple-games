/**
 * Echo Pads — the español catalog. Provenance (docs/ECHO_PADS_RULES.md §14):
 * `machine` — written by an AI from the English source on 2026-10-22; nobody
 * has read it, native speaker or author. The title (`echoPadsName`) stays
 * "Echo Pads".
 *
 * Terms (§14's glossary): botón (pad), secuencia, longitud, Reproducir / Escuchar otra vez / Detener, Ritmo: Tranquilo / Medio / Rápido.
 */
import type { EchoPadsMessages } from './en';

export const es: EchoPadsMessages = {
  echoPadsName: 'Echo Pads',
  echoPadsTier_4: '4 botones',
  echoPadsTier_6: '6 botones',
  echoPadsLength: 'Longitud {n}',
  echoPadsLevelDetail: '{tier} · longitud {length}',
  echoPadsPace: 'Ritmo',
  echoPadsPace_calm: 'Tranquilo',
  echoPadsPace_normal: 'Medio',
  echoPadsPace_quick: 'Rápido',
  echoPadsPlay: 'Reproducir',
  echoPadsListenAgain: 'Escuchar otra vez',
  echoPadsStop: 'Detener',
  echoPadsRound: 'Longitud {k} de {target}',
  echoPadsStatusIdle: 'Pulsa Reproducir para oír {k} botones.',
  echoPadsStatusPlaying: 'Reproduciendo {k} botones…',
  echoPadsStatusYourTurn: 'Tu turno: toca los {k} botones en el mismo orden.',
  echoPadsStatusAgain: 'Toca de nuevo los {k} botones, desde el primero.',
  echoPadsStatusReview: 'Reproduciendo otra vez los {k} botones de esta ronda…',
  echoPadsMark_circle: 'Círculo',
  echoPadsMark_triangle: 'Triángulo',
  echoPadsMark_square: 'Cuadrado',
  echoPadsMark_star: 'Estrella',
  echoPadsMark_diamond: 'Rombo',
  echoPadsMark_cross: 'Cruz',
  echoPadsPos_topLeft: 'arriba a la izquierda',
  echoPadsPos_topMiddle: 'arriba en el centro',
  echoPadsPos_topRight: 'arriba a la derecha',
  echoPadsPos_bottomLeft: 'abajo a la izquierda',
  echoPadsPos_bottomMiddle: 'abajo en el centro',
  echoPadsPos_bottomRight: 'abajo a la derecha',
  echoPadsPadLabel: '{mark}, {position}',
  echoPadsPadsLabel: 'Botones',
  echoPadsExpectedLabel: '{pad} (el botón que venía después)',
  echoPadsMissTitle: 'La partida terminó en la longitud {k}',
  echoPadsMissBody: 'El botón {index} de {k} era: {pad}.',
  echoPadsResultTitle: 'Los {n} repetidos',
  echoPadsLongest: 'Más larga repetida',
  echoPadsLongestNone: 'Ninguna',
  echoPadsReplays: 'Escuchado otra vez',
  echoPadsPacesHeard: 'Ritmo',
  echoPadsNewSequence: 'Nueva secuencia',
  echoPadsLevelCell: '{level}, {detail}',
  echoPadsLevelCellCleared: '{level}, {detail}, superado',
  echoPadsReplaceTitle: '¿Reemplazar la partida en curso?',
  echoPadsReplaceBody: 'La partida de {current} se reemplazará por una nueva partida de {next}.',
  echoPadsStatStarted: 'Partidas empezadas',
  echoPadsStatCleared: 'Superadas',
  echoPadsStatMissed: 'Terminadas por un fallo',
  echoPadsStatLevels: 'Niveles superados',
  echoPadsStatDays: 'Días completados',
  echoPadsStep1Title: 'Escucha',
  echoPadsStep1Body:
    'Pulsa ▶ y los botones se iluminan y suenan uno a uno: recuerda el orden (hasta tu primer toque puedes volver a escucharlo las veces que quieras).',
  echoPadsStep2Title: 'Repite',
  echoPadsStep2Body: 'Luego toca los botones en el mismo orden.',
  echoPadsStep3Title: 'Crece',
  echoPadsStep3Body: 'Cada vez que lo repites, el orden crece en uno; no hay límite de tiempo.',
};
