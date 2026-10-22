/**
 * Echo Pads — the Bahasa Indonesia catalog. Provenance (docs/ECHO_PADS_RULES.md §14):
 * `machine` — written by an AI from the English source on 2026-10-22; nobody
 * has read it, native speaker or author. The title (`echoPadsName`) stays
 * "Echo Pads".
 *
 * Terms (§14's glossary): tombol (pad), urutan (sequence), panjang (length), Putar / Dengar lagi / Berhenti, Tempo: Santai / Sedang / Cepat.
 */
import type { EchoPadsMessages } from './en';

export const id: EchoPadsMessages = {
  echoPadsName: 'Echo Pads',
  echoPadsTier_4: '4 tombol',
  echoPadsTier_6: '6 tombol',
  echoPadsLength: 'Panjang {n}',
  echoPadsLevelDetail: '{tier} · panjang {length}',
  echoPadsPace: 'Tempo',
  echoPadsPace_calm: 'Santai',
  echoPadsPace_normal: 'Sedang',
  echoPadsPace_quick: 'Cepat',
  echoPadsPlay: 'Putar',
  echoPadsListenAgain: 'Dengar lagi',
  echoPadsStop: 'Berhenti',
  echoPadsRound: 'Panjang {k} dari {target}',
  echoPadsStatusIdle: 'Tekan Putar untuk mendengar {k} tombol.',
  echoPadsStatusPlaying: 'Memutar {k} tombol…',
  echoPadsStatusYourTurn: 'Giliranmu: ketuk {k} tombol dengan urutan yang sama.',
  echoPadsStatusAgain: 'Ketuk lagi ke-{k} tombol, mulai dari yang pertama.',
  echoPadsStatusReview: 'Memutar lagi {k} tombol ronde ini…',
  echoPadsMark_circle: 'Lingkaran',
  echoPadsMark_triangle: 'Segitiga',
  echoPadsMark_square: 'Persegi',
  echoPadsMark_star: 'Bintang',
  echoPadsMark_diamond: 'Belah ketupat',
  echoPadsMark_cross: 'Silang',
  echoPadsPos_topLeft: 'kiri atas',
  echoPadsPos_topMiddle: 'tengah atas',
  echoPadsPos_topRight: 'kanan atas',
  echoPadsPos_bottomLeft: 'kiri bawah',
  echoPadsPos_bottomMiddle: 'tengah bawah',
  echoPadsPos_bottomRight: 'kanan bawah',
  echoPadsPadLabel: '{mark}, {position}',
  echoPadsPadsLabel: 'Tombol',
  echoPadsExpectedLabel: '{pad} (tombol yang muncul berikutnya)',
  echoPadsMissTitle: 'Permainan berakhir di panjang {k}',
  echoPadsMissBody: 'Tombol ke-{index} dari {k} adalah: {pad}.',
  echoPadsResultTitle: 'Semua {n} terulang',
  echoPadsLongest: 'Terpanjang yang diulang',
  echoPadsLongestNone: 'Tidak ada',
  echoPadsReplays: 'Didengar lagi',
  echoPadsPacesHeard: 'Tempo',
  echoPadsNewSequence: 'Urutan baru',
  echoPadsLevelCell: '{level}, {detail}',
  echoPadsLevelCellCleared: '{level}, {detail}, selesai',
  echoPadsReplaceTitle: 'Ganti permainan yang sedang berjalan?',
  echoPadsReplaceBody: 'Permainan di {current} akan diganti dengan permainan baru di {next}.',
  echoPadsStatStarted: 'Permainan dimulai',
  echoPadsStatCleared: 'Selesai',
  echoPadsStatMissed: 'Berakhir karena salah',
  echoPadsStatLevels: 'Level selesai',
  echoPadsStatDays: 'Hari selesai',
  echoPadsStep1Title: 'Dengarkan',
  echoPadsStep1Body:
    'Tekan ▶ dan tombol menyala serta berbunyi satu per satu — ingat urutannya (sebelum ketukan pertama, kamu bisa mendengar lagi sesering yang kamu mau).',
  echoPadsStep2Title: 'Ulangi',
  echoPadsStep2Body: 'Lalu ketuk tombol dengan urutan yang sama.',
  echoPadsStep3Title: 'Bertambah',
  echoPadsStep3Body: 'Setiap kali kamu mengulanginya, urutan bertambah satu — tanpa batas waktu.',
};
