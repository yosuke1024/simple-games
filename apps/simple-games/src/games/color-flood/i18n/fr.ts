// AI translation draft, including Japanese; no human/native review claimed.
import type { ColorFloodMessages } from './en';
export const fr: ColorFloodMessages = {
  colorFloodName: 'Color Flood',
  colorFloodChooseColour: 'Choisir une couleur',
  colorFloodChoose: 'Choisir une grille',
  colorFloodBest: 'Moins de coups',
  colorFloodBoard: 'Grille',
  colorFloodClear: 'Une seule couleur !',
  colorFloodClearBody: 'Toute la grille est reliée.',
  colorFloodRule1:
    'Partez de la case en haut à gauche et choisissez une couleur qui touche votre zone.',
  colorFloodRule2:
    'La zone change de couleur et absorbe toutes les cases reliées de cette couleur.',
  colorFloodRule3:
    'Couvrez la grille en moins de coups. Aucun nombre limite de coups, et vous pouvez toujours annuler.',
  colorFloodCell: 'Ligne {row}, colonne {col} : {symbol}',
  colorFloodColour: 'Couleur {number} : {symbol}',
  colorFloodStatus: 'Reliées : {count} / {total}',
};
