/** AI-written draft; no human or native review. */
import type { ThreePeaksMessages } from './en';
export const de: ThreePeaksMessages = {
  threePeaksName: 'Three Peaks',
  threePeaksStep1Title: 'Räume die drei Gipfel ab',
  threePeaksStep1Body:
    'Entferne freie Karten, deren Wert um eins höher oder niedriger als die Ablage ist, um alle drei Gipfel abzuräumen.',
  threePeaksStep2Title: 'Das Ass verbindet beide Enden',
  threePeaksStep2Body: 'K–A–2 gilt in beide Richtungen. Die Kartenfarbe spielt keine Rolle.',
  threePeaksStep3Title: 'Ziehen oder zurücknehmen',
  threePeaksStep3Body:
    'Ziehe bei Bedarf eine neue Ablagekarte. Der Stapel wird nur einmal durchlaufen. Jeder Zug lässt sich zurücknehmen, auch nach Spielende.',
  threePeaksDraw: 'Ziehen',
  threePeaksStock: 'Stapel',
  threePeaksWaste: 'Ablage',
  threePeaksDrawCount: 'Karte ziehen; {count} übrig',
  threePeaksCardsLeft: 'Verbleibende Karten',
  threePeaksWon: 'Alle Gipfel abgeräumt!',
  threePeaksStuck: 'Keine Züge mehr',
  threePeaksStuckBody:
    'Der Stapel ist leer und keine freie Karte passt. Nimm einen Zug zurück und versuche einen anderen Weg.',
  threePeaksUndoHint: 'Unbegrenzt zurücknehmen, auch gezogene Karten und nach Spielende.',
  threePeaksWins: 'Siege',
  threePeaksBest: 'Wenigste verbleibende Karten',
  threePeaksBoard: 'Spielfeld mit drei Gipfeln',
  threePeaksCovered: 'Karte {position}, verdeckt',
  threePeaksCardLabel: 'Karte {position}: {rank} {suit}, {state}',
  threePeaksCanMove: 'kann bewegt werden',
  threePeaksCannotMove: 'kann nicht bewegt werden',
  threePeaksSpades: 'Pik',
  threePeaksHearts: 'Herz',
  threePeaksDiamonds: 'Karo',
  threePeaksClubs: 'Kreuz',
  threePeaksKeyboard: 'Pfeiltasten: Karte wählen · D: ziehen · Strg/Cmd+Z: zurücknehmen',
};
