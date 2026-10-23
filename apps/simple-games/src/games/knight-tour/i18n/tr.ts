/** AI-authored translation draft; no human review claimed. See docs/KNIGHT_TOUR_RULES.md. */
import type { KnightTourMessages } from './en';
export const tr: KnightTourMessages = {
  knightTourName: 'Knight’s Tour',
  knightTourVisited: 'Ziyaret: {count} / {total}',
  knightTourBoard: 'Tahta',
  knightTourCurrent: 'At, mevcut kare',
  knightTourVisitNumber: '{count}. ziyaret',
  knightTourLegal: 'Geçerli hedef',
  knightTourEmpty: 'Ziyaret edilmedi',
  knightTourCell: '{row}. satır, {col}. sütun: {content}',
  knightTourPaused: 'Duraklatıldı. Hazır olunca devam et.',
  knightTourStuck: 'Hamle kalmadı. Başka bir yol için geri al.',
  knightTourInstruction: 'Noktalı kareye L şeklinde ilerle.',
  knightTourNewBoard: 'Yeni tahta',
  knightTourWon: 'Tur tamamlandı!',
  knightTourWins: 'Tamamlanan',
  knightTourStep1Title: 'L şeklinde ilerle',
  knightTourStep1Body:
    'At bir yönde iki kare, yana bir kare gider; noktalar geçerli hedefleri gösterir.',
  knightTourStep2Title: 'Her kareye bir kez git',
  knightTourStep2Body: 'Her ziyaret bir numara ekler; ziyaret edilen kareye tekrar gidilemez.',
  knightTourStep3Title: 'Kendi hızında keşfet',
  knightTourStep3Body:
    'Bitirmek için tüm kareleri ziyaret et. Çıkmaza girersen geri alıp başka bir yol deneyebilirsin.',
};
