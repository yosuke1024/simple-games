import type { CrownGridMessages } from './en';

export const id: CrownGridMessages = {
  crownGridName: 'Crown Grid',
  crownGridChooseBoard: 'Pilih papan',
  crownGridDifficulty_easy: 'Mudah',
  crownGridDifficulty_medium: 'Sedang',
  crownGridDifficulty_hard: 'Sulit',
  crownGridBoardNote: '{size}×{size}',
  crownGridConfirmSwitchTitle: 'Ganti papan yang sedang berjalan?',
  crownGridConfirmSwitchBody:
    'Permainan {current} Anda akan diganti dengan papan {next} yang baru.',
  crownGridBoardLabel: 'Papan Crown Grid, {size}×{size}',
  crownGridCellEmpty: 'Kosong, baris {row}, kolom {col}, wilayah {region}',
  crownGridCellCross: 'Dicoret, baris {row}, kolom {col}, wilayah {region}',
  crownGridCellCrown: 'Mahkota, baris {row}, kolom {col}, wilayah {region}',
  crownGridRuleBroken: 'melanggar aturan',
  crownGridHintViolation: 'Mahkota yang disorot melanggar aturan.',
  crownGridHintWrong: 'Mahkota yang ditandai tidak mungkin benar.',
  crownGridHintSingle_row:
    'Baris yang disorot hanya memiliki satu kotak tersisa untuk mahkotanya: kotak yang berbingkai.',
  crownGridHintSingle_col:
    'Kolom yang disorot hanya memiliki satu kotak tersisa untuk mahkotanya: kotak yang berbingkai.',
  crownGridHintSingle_region:
    'Wilayah yang disorot hanya memiliki satu kotak tersisa untuk mahkotanya: kotak yang berbingkai.',
  crownGridHintConfine_regionRow:
    'Wilayah yang disorot hanya bisa menaruh mahkotanya di kotak-kotak yang diwarnai, semuanya berada di satu baris — jadi kotak lain di baris itu (berbingkai) tidak mungkin.',
  crownGridHintConfine_regionCol:
    'Wilayah yang disorot hanya bisa menaruh mahkotanya di kotak-kotak yang diwarnai, semuanya berada di satu kolom — jadi kotak lain di kolom itu (berbingkai) tidak mungkin.',
  crownGridHintConfine_rowRegion:
    'Baris yang disorot hanya bisa menaruh mahkotanya di kotak-kotak yang diwarnai, semuanya berada di satu wilayah — jadi kotak lain di wilayah itu (berbingkai) tidak mungkin.',
  crownGridHintConfine_colRegion:
    'Kolom yang disorot hanya bisa menaruh mahkotanya di kotak-kotak yang diwarnai, semuanya berada di satu wilayah — jadi kotak lain di wilayah itu (berbingkai) tidak mungkin.',
  crownGridHintAttack_row:
    'Mahkota di kotak berbingkai akan menyingkirkan semua kotak yang diwarnai, sehingga baris yang disorot tidak punya tempat lagi untuk mahkotanya.',
  crownGridHintAttack_col:
    'Mahkota di kotak berbingkai akan menyingkirkan semua kotak yang diwarnai, sehingga kolom yang disorot tidak punya tempat lagi untuk mahkotanya.',
  crownGridHintAttack_region:
    'Mahkota di kotak berbingkai akan menyingkirkan semua kotak yang diwarnai, sehingga wilayah yang disorot tidak punya tempat lagi untuk mahkotanya.',
  crownGridHintPair_regionsRows:
    'Kedua wilayah yang disorot hanya bisa menaruh mahkotanya di kotak-kotak yang diwarnai, yang pas berada di tepat dua baris — jadi kotak lain di kedua baris itu (berbingkai) tidak mungkin.',
  crownGridHintPair_regionsCols:
    'Kedua wilayah yang disorot hanya bisa menaruh mahkotanya di kotak-kotak yang diwarnai, yang pas berada di tepat dua kolom — jadi kotak lain di kedua kolom itu (berbingkai) tidak mungkin.',
  crownGridHintPair_rowsRegions:
    'Kedua baris yang disorot hanya bisa menaruh mahkotanya di kotak-kotak yang diwarnai, yang pas berada di tepat dua wilayah — jadi kotak lain di kedua wilayah itu (berbingkai) tidak mungkin.',
  crownGridHintPair_colsRegions:
    'Kedua kolom yang disorot hanya bisa menaruh mahkotanya di kotak-kotak yang diwarnai, yang pas berada di tepat dua wilayah — jadi kotak lain di kedua wilayah itu (berbingkai) tidak mungkin.',
  crownGridHintHypothesis_row:
    'Coba taruh mahkota di kotak berbingkai: langkah yang terpaksa terjadi membuat baris yang disorot tidak punya tempat lagi untuk mahkotanya, jadi kotak itu tidak mungkin.',
  crownGridHintHypothesis_col:
    'Coba taruh mahkota di kotak berbingkai: langkah yang terpaksa terjadi membuat kolom yang disorot tidak punya tempat lagi untuk mahkotanya, jadi kotak itu tidak mungkin.',
  crownGridHintHypothesis_region:
    'Coba taruh mahkota di kotak berbingkai: langkah yang terpaksa terjadi membuat wilayah yang disorot tidak punya tempat lagi untuk mahkotanya, jadi kotak itu tidak mungkin.',
  crownGridHintNone: 'Belum ada langkah pasti saat ini.',
  crownGridSolvedTitle: 'Selesai!',
  crownGridSolvedBody: 'Setiap baris, kolom, dan wilayah berisi satu mahkota.',
  crownGridHintsUsed: 'Petunjuk terpakai',
  crownGridNewBestTime: 'Tercepat sejauh ini.',
  crownGridNewBoard: 'Papan baru',
  crownGridDailySection: 'Harian',
  crownGridDailiesSolved: 'Hari terselesaikan',
  crownGridDailyBacklogHint: 'Hari-hari sebelumnya tetap terbuka.',
  crownGridStep1Title: 'Satu mahkota masing-masing',
  crownGridStep1Body: 'Setiap baris, setiap kolom, dan setiap warna berisi tepat satu mahkota.',
  crownGridStep2Title: 'Mahkota tidak bersentuhan',
  crownGridStep2Body: 'Dua mahkota tidak boleh bersebelahan, bahkan secara diagonal.',
  crownGridStep3Title: 'Ketuk dan seret',
  crownGridStep3Body:
    'Ketuk kotak untuk berganti ×, mahkota, kosong; seret untuk menandai beberapa ×. Buntu? Minta petunjuk.',
};
