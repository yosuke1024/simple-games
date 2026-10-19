/**
 * Indonesian catalog for Bridges. Provenance (docs/BRIDGES_RULES.md §14,
 * docs/I18N_POLICY.md): `machine` — written with AI assistance and **not read
 * by a native speaker**. The title (`bridgesName`) is a proper noun and stays
 * as-is in every locale; placeholder names match the English source.
 */
import type { BridgesMessages } from './en';

export const id: BridgesMessages = {
  bridgesName: 'Bridges',
  bridgesChooseBoard: 'Pilih papan',
  bridgesDifficulty_easy: 'Mudah',
  bridgesDifficulty_medium: 'Sedang',
  bridgesDifficulty_hard: 'Sulit',
  bridgesBoardNote: '{width}×{height}',
  bridgesConfirmSwitchTitle: 'Ganti papan yang sedang dimainkan?',
  bridgesConfirmSwitchBody: 'Papan {current} Anda akan diganti dengan papan {next} yang baru.',
  bridgesBoardLabel: 'Papan Bridges, {width} kali {height}, {islands} pulau',
  bridgesIslandOpen: 'Pulau {value}, baris {row}, kolom {col}: {count} dari {value} jembatan',
  bridgesIslandComplete: 'Pulau {value}, baris {row}, kolom {col}: lengkap',
  bridgesIslandOver: 'Pulau {value}, baris {row}, kolom {col}: {count} jembatan, terlalu banyak',
  bridgesIslandSelected: '{island}. Dipilih',
  bridgesIslandPartner:
    '{island}. Bisa dihubungkan ke pulau yang dipilih: {bridges} dari 2 jembatan',
  bridgesIslandHinted: '{island}. Disorot oleh petunjuk',
  bridgesIslandHintRing: '{island}. Disorot oleh petunjuk, di lingkaran titik-titik',
  bridgesAnnounceNone:
    'Tidak ada jembatan antara baris {row1}, kolom {col1} dan baris {row2}, kolom {col2}',
  bridgesAnnounceOne:
    'Satu jembatan antara baris {row1}, kolom {col1} dan baris {row2}, kolom {col2}',
  bridgesAnnounceTwo:
    'Dua jembatan antara baris {row1}, kolom {col1} dan baris {row2}, kolom {col2}',
  bridgesSplitNote:
    'Semua angka sudah terpenuhi, tetapi pulau-pulau terbagi menjadi {groups} kelompok. Satukan semuanya.',
  bridgesHintWrong: 'Terlalu banyak jembatan di antara pulau yang disorot.',
  bridgesHintOne: 'Pasangan yang disorot butuh setidaknya satu jembatan.',
  bridgesHintTwo: 'Pasangan yang disorot butuh dua jembatan.',
  bridgesHintOneAt:
    'Hitung dari pulau di lingkaran titik-titik: pasangan yang disorot butuh setidaknya satu jembatan.',
  bridgesHintTwoAt:
    'Hitung dari pulau di lingkaran titik-titik: pasangan yang disorot butuh dua jembatan.',
  bridgesHintNone: 'Belum ada langkah pasti dari sini.',
  bridgesHintWhere: 'Disorot: baris {row1}, kolom {col1} dan baris {row2}, kolom {col2}.',
  bridgesHintWhereRing:
    'Disorot: baris {row1}, kolom {col1} dan baris {row2}, kolom {col2}. Lingkaran titik-titik: baris {row}, kolom {col}.',
  bridgesSolvedTitle: 'Semua terhubung!',
  bridgesSolvedBody: 'Semua pulau tergabung dalam satu jaringan.',
  bridgesHintsUsed: 'Petunjuk terpakai',
  bridgesNewBestTime: 'Tercepat sejauh ini.',
  bridgesNewBoard: 'Papan baru',
  bridgesSolvedCount: 'Papan selesai',
  bridgesDailySection: 'Harian',
  bridgesDailiesCleared: 'Hari selesai',
  bridgesAllModes: 'Semua mode',
  bridgesStep1Title: 'Angka menentukan jembatan',
  bridgesStep1Body: 'Setiap pulau mendapat jembatan tepat sebanyak angkanya.',
  bridgesStep2Title: 'Lurus, paling banyak dua',
  bridgesStep2Body:
    'Jembatan berjalan lurus mendatar atau tegak, tidak pernah bersilangan, dan paling banyak dua menghubungkan pasangan yang sama.',
  bridgesStep3Title: 'Hubungkan semuanya',
  bridgesStep3Body:
    'Ketuk satu pulau, lalu pasangan berlingkar untuk menambah jembatan (lagi untuk dua, lagi untuk nol), sampai semua pulau terhubung.',
};
