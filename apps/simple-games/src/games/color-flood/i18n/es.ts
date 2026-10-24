// AI translation draft, including Japanese; no human/native review claimed.
import type { ColorFloodMessages } from './en';
export const es: ColorFloodMessages = {
  colorFloodName: 'Color Flood',
  colorFloodChooseColour: 'Elige un color',
  colorFloodChoose: 'Elige un tablero',
  colorFloodBest: 'Menos movimientos',
  colorFloodBoard: 'Tablero',
  colorFloodClear: '¡Un solo color!',
  colorFloodClearBody: 'Todo el tablero está conectado.',
  colorFloodRule1: 'Empieza en la esquina superior izquierda y elige un color que toque tu región.',
  colorFloodRule2:
    'La región cambia de color y absorbe todas las casillas conectadas de ese color.',
  colorFloodRule3:
    'Cubre el tablero en menos movimientos. No hay límite de movimientos y siempre puedes deshacer.',
  colorFloodCell: 'Fila {row}, columna {col}: {symbol}',
  colorFloodColour: 'Color {number}: {symbol}',
  colorFloodStatus: 'Conectadas: {count} / {total}',
};
