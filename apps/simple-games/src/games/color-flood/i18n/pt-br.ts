// AI translation draft, including Japanese; no human/native review claimed.
import type { ColorFloodMessages } from './en';
export const ptBR: ColorFloodMessages = {
  colorFloodName: 'Color Flood',
  colorFloodChooseColour: 'Escolha uma cor',
  colorFloodChoose: 'Escolha um tabuleiro',
  colorFloodBest: 'Menos movimentos',
  colorFloodBoard: 'Tabuleiro',
  colorFloodClear: 'Uma só cor!',
  colorFloodClearBody: 'O tabuleiro inteiro está conectado.',
  colorFloodRule1: 'Comece na casa superior esquerda e escolha uma cor que toque sua região.',
  colorFloodRule2: 'A região muda de cor e absorve todas as casas conectadas dessa cor.',
  colorFloodRule3:
    'Cubra o tabuleiro em menos movimentos. Não há limite de movimentos e você sempre pode desfazer.',
  colorFloodCell: 'Linha {row}, coluna {col}: {symbol}',
  colorFloodColour: 'Cor {number}: {symbol}',
  colorFloodStatus: 'Conectadas: {count} / {total}',
};
