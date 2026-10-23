/** AI-authored translation draft; no human review claimed. See docs/KNIGHT_TOUR_RULES.md. */
import type { KnightTourMessages } from './en';
export const id: KnightTourMessages = {
  knightTourName: 'Knight’s Tour',
  knightTourVisited: 'Dikunjungi: {count} / {total}',
  knightTourBoard: 'Papan',
  knightTourCurrent: 'Kuda, petak saat ini',
  knightTourVisitNumber: 'Kunjungan {count}',
  knightTourLegal: 'Tujuan yang sah',
  knightTourEmpty: 'Belum dikunjungi',
  knightTourCell: 'Baris {row}, kolom {col}: {content}',
  knightTourPaused: 'Dijeda. Lanjutkan saat siap.',
  knightTourStuck: 'Tidak ada langkah. Urungkan untuk mencoba rute lain.',
  knightTourInstruction: 'Bergerak membentuk L ke petak bertitik.',
  knightTourNewBoard: 'Papan baru',
  knightTourWon: 'Tur selesai!',
  knightTourWins: 'Selesai',
  knightTourStep1Title: 'Bergerak membentuk L',
  knightTourStep1Body:
    'Kuda bergerak dua petak ke satu arah lalu satu ke samping; titik menandai tujuan yang sah.',
  knightTourStep2Title: 'Kunjungi setiap petak sekali',
  knightTourStep2Body:
    'Setiap petak yang dikunjungi diberi nomor; petak tersebut tidak bisa dikunjungi lagi.',
  knightTourStep3Title: 'Jelajahi dengan santai',
  knightTourStep3Body:
    'Kunjungi semua petak untuk selesai. Jika buntu, urungkan dan coba rute lain.',
};
