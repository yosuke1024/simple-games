/**
 * Indonesian catalog for Shape Regions (docs/I18N_POLICY.md: provenance
 * `machine`). The title (`shapeRegionsName`) is a proper noun and stays
 * as-is in every locale; placeholder names match the English source.
 */
import type { ShapeRegionsMessages } from './en';

export const id: ShapeRegionsMessages = {
  shapeRegionsName: 'Shape Regions',
  shapeRegionsChooseBoard: 'Pilih papan',
  shapeRegionsDifficulty_easy: 'Mudah',
  shapeRegionsDifficulty_medium: 'Sedang',
  shapeRegionsDifficulty_hard: 'Sulit',
  shapeRegionsBoardNote: '{width}×{height}',
  shapeRegionsConfirmSwitchTitle: 'Ganti papan yang sedang berjalan?',
  shapeRegionsConfirmSwitchBody: 'Permainan {current} Anda akan diganti dengan papan {next} baru.',
  shapeRegionsBoardLabel: 'Papan Shape Regions, {width} kali {height}',
  shapeRegionsCellAssigned: 'Baris {row}, kolom {col}, bentuk {region}',
  shapeRegionsCellEmpty: 'Baris {row}, kolom {col}, kosong',
  shapeRegionsClueCount: '{count} dari {size} sel',
  shapeRegionsRuleBroken: 'melanggar aturan',
  shapeRegionsShape_line: 'Garis',
  shapeRegionsShape_block: 'Persegi panjang',
  shapeRegionsShape_corner: 'Sudut',
  shapeRegionsShape_tee: 'Bentuk T',
  shapeRegionsShape_step: 'Tangga',
  shapeRegionsHintWrong: 'Bentuk yang disorot tidak cocok dengan jawaban.',
  shapeRegionsHintForced: 'Sel yang ditandai hanya bisa menjadi bagian bentuk yang disorot.',
  shapeRegionsHintSole: 'Bentuk yang disorot hanya punya satu cara untuk diletakkan.',
  shapeRegionsHintCommon:
    'Bagaimanapun bentuk yang disorot diletakkan, sel yang ditandai selalu termasuk.',
  shapeRegionsHintNone: 'Belum ada langkah pasti yang ditemukan.',
  shapeRegionsSolvedTitle: 'Selesai!',
  shapeRegionsSolvedBody: 'Setiap sel sudah masuk bentuknya.',
  shapeRegionsHintsUsed: 'Petunjuk dipakai',
  shapeRegionsNewBestTime: 'Tercepat Anda sejauh ini.',
  shapeRegionsNewBoard: 'Papan baru',
  shapeRegionsSolvedCount: 'Teka-teki selesai',
  shapeRegionsDailySection: 'Harian',
  shapeRegionsDailiesCleared: 'Hari selesai',
  shapeRegionsStep1Title: 'Angka dan simbol',
  shapeRegionsStep1Body: 'Angka adalah jumlah sel bentuk itu; simbol adalah wujudnya.',
  shapeRegionsStep2Title: 'Tumbuh dari petunjuk',
  shapeRegionsStep2Body: 'Seret dari petunjuk melewati sel tetangga untuk menumbuhkan bentuknya.',
  shapeRegionsStep3Title: 'Isi papan',
  shapeRegionsStep3Body:
    'Saat selesai, setiap sel masuk ke suatu bentuk. Ketuk sel untuk melepasnya.',
};
