/**
 * Indonesian catalog for Box Regions — machine translation of the English
 * source, unreviewed (docs/I18N_POLICY.md: provenance `machine`). The title
 * (`boxRegionsName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source.
 */
import type { BoxRegionsMessages } from './en';

export const id: BoxRegionsMessages = {
  boxRegionsName: 'Box Regions',
  boxRegionsChooseBoard: 'Pilih papan',
  boxRegionsDifficulty_easy: 'Mudah',
  boxRegionsDifficulty_medium: 'Sedang',
  boxRegionsDifficulty_hard: 'Sulit',
  boxRegionsBoardNote: '{width}×{height}',
  boxRegionsConfirmSwitchTitle: 'Ganti papan yang sedang dimainkan?',
  boxRegionsConfirmSwitchBody:
    'Permainan {current} Anda akan diganti dengan papan {next} yang baru.',
  boxRegionsBoardLabel: 'Papan Box Regions, {width} kali {height}',
  boxRegionsCellAssigned: 'Baris {row}, kolom {col}, kotak {region}',
  boxRegionsCellEmpty: 'Baris {row}, kolom {col}, belum masuk kotak',
  boxRegionsClueCount: '{count} dari {size} sel',
  boxRegionsRuleBroken: 'melanggar aturan',
  boxRegionsKind_square: 'Persegi',
  boxRegionsKind_tall: 'Tinggi',
  boxRegionsKind_wide: 'Lebar',
  boxRegionsKind_free: 'Kotak bebas',
  boxRegionsHintWrong: 'Kotak yang disorot tidak cocok dengan jawaban.',
  boxRegionsHintForced:
    'Sel yang ditandai hanya bisa menjadi bagian dari kotak petunjuk yang disorot.',
  boxRegionsHintSole: 'Kotak ini hanya bisa digambar dengan satu cara.',
  boxRegionsHintCommon:
    'Bagaimanapun kotak petunjuk ini digambar, sel yang ditandai selalu ikut tercakup.',
  boxRegionsHintNone: 'Belum ada langkah pasti saat ini.',
  boxRegionsSolvedTitle: 'Selesai!',
  boxRegionsSolvedBody: 'Setiap sel sudah berada di kotaknya.',
  boxRegionsHintsUsed: 'Bantuan dipakai',
  boxRegionsNewBestTime: 'Tercepat Anda.',
  boxRegionsNewBoard: 'Papan baru',
  boxRegionsSolvedCount: 'Teka-teki selesai',
  boxRegionsDailySection: 'Harian',
  boxRegionsDailiesCleared: 'Hari terselesaikan',
  boxRegionsDailyBacklogHint: 'Semua hari sebelumnya tetap terbuka.',
  boxRegionsStep1Title: 'Bagi menjadi kotak',
  boxRegionsStep1Body:
    'Bagi papan menjadi persegi panjang, masing-masing berisi tepat satu petunjuk.',
  boxRegionsStep2Title: 'Baca petunjuk',
  boxRegionsStep2Body:
    'Angka menunjukkan jumlah sel dalam kotak; simbol menunjukkan persegi, tinggi, lebar, atau bebas.',
  boxRegionsStep3Title: 'Gambar dari sudut ke sudut',
  boxRegionsStep3Body:
    'Seret dari satu sudut ke sudut lainnya untuk menggambar kotak. Ketuk kotak untuk menghapusnya. Buntu? Coba bantuan.',
};
