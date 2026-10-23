// AI translation draft, including Japanese; no human/native review claimed.
import type { ColorFloodMessages } from './en';
export const de: ColorFloodMessages = {
  colorFloodName: 'Color Flood',
  colorFloodChooseColour: 'Farbe wählen',
  colorFloodChoose: 'Feld wählen',
  colorFloodBest: 'Wenigste Züge',
  colorFloodBoard: 'Feld',
  colorFloodClear: 'Eine einzige Farbe!',
  colorFloodClearBody: 'Das ganze Feld ist verbunden.',
  colorFloodRule1: 'Beginne oben links und wähle eine Farbe, die an deinen Bereich grenzt.',
  colorFloodRule2:
    'Der Bereich wechselt die Farbe und nimmt alle verbundenen Felder dieser Farbe auf.',
  colorFloodRule3:
    'Fülle das Feld mit weniger Zügen. Es gibt kein Zuglimit und du kannst jederzeit zurücknehmen.',
  colorFloodCell: 'Zeile {row}, Spalte {col}: {symbol}',
  colorFloodColour: 'Farbe {number}: {symbol}',
  colorFloodStatus: 'Verbunden: {count} / {total}',
};
