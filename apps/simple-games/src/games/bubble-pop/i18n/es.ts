import type { BubblePopMessages } from './en';

export const es: BubblePopMessages = {
  bubbleName: 'Bubble Pop',
  bubbleBoardLabel: 'Tablero de Bubble Pop',
  bubbleShotsLabel: '{n} disparos para que baje el techo',
  bubbleCurrentLabel: 'Burbuja actual: {color}',
  bubbleNextLabel: 'Próxima burbuja: {color}',
  bubbleSwapLabel: 'Intercambiar la burbuja actual con la próxima',
  bubbleAimLabel: 'Apuntando — cae en la fila {row}, columna {col}',
  bubbleClearedTitle: '¡Tablero despejado!',
  bubbleClearedBody: 'No queda ninguna burbuja.',
  bubbleFailedTitle: 'Esta vez no',
  bubbleFailedBody: 'Reintentar es gratis: mismo tablero, mismas burbujas.',
  bubbleStep1Title: 'Arrastra para apuntar',
  bubbleStep1Body: 'La línea guía siempre muestra dónde caerá la burbuja — gratis, siempre activa.',
  bubbleStep2Title: '3 en línea revientan',
  bubbleStep2Body:
    'Junta 3 o más burbujas del mismo color y revientan. Las que quedan flotando también caen.',
  bubbleStep3Title: 'El techo baja poco a poco',
  bubbleStep3Body:
    'Cada pocos disparos el techo baja una fila. Despeja las burbujas antes de que una llegue a la línea punteada.',
  bubbleColor_blue: 'azul',
  bubbleColor_green: 'verde',
  bubbleColor_yellow: 'amarillo',
  bubbleColor_purple: 'morado',
  bubbleColor_orange: 'naranja',
  bubbleColor_cyan: 'cian',
};
