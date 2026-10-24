/**
 * Indonesian catalog for Pipe Link. Provenance (docs/PIPE_LINK_RULES.md §11):
 * machine-written by AI from the English source and **not read by any native
 * speaker** — not a reviewed translation. The title (`pipeLinkName`) is a
 * proper noun and stays as-is; placeholder names match the English source.
 */
import type { PipeLinkMessages } from './en';

export const id: PipeLinkMessages = {
  pipeLinkName: 'Pipe Link',
  pipeLinkChooseBoard: 'Pilih papan',
  pipeLinkDifficulty_easy: 'Mudah',
  pipeLinkDifficulty_medium: 'Sedang',
  pipeLinkDifficulty_hard: 'Sulit',
  pipeLinkBoardNote: '{width}×{height}',
  pipeLinkConfirmSwitchTitle: 'Ganti papan yang sedang dimainkan?',
  pipeLinkConfirmSwitchBody: 'Papan {current} Anda akan diganti dengan papan {next} yang baru.',
  pipeLinkBoardLabel: 'Papan Pipe Link, {width} kali {height}',
  pipeLinkTile: 'Baris {row}, kolom {col}: {pipes}, {light}',
  pipeLinkTileSource: 'Baris {row}, kolom {col}, sumber: {pipes}, {light}',
  pipeLinkTileHinted: '{tile}. Petunjuk: putar ke {pipes}',
  pipeLinkLit: 'terisi',
  pipeLinkUnlit: 'kosong',
  pipeLinkPipes_end_0: 'ujung, terbuka ke atas',
  pipeLinkPipes_end_1: 'ujung, terbuka ke kanan',
  pipeLinkPipes_end_2: 'ujung, terbuka ke bawah',
  pipeLinkPipes_end_3: 'ujung, terbuka ke kiri',
  pipeLinkPipes_straight_0: 'lurus, atas dan bawah',
  pipeLinkPipes_straight_1: 'lurus, kiri dan kanan',
  pipeLinkPipes_elbow_0: 'belokan, atas dan kanan',
  pipeLinkPipes_elbow_1: 'belokan, kanan dan bawah',
  pipeLinkPipes_elbow_2: 'belokan, bawah dan kiri',
  pipeLinkPipes_elbow_3: 'belokan, kiri dan atas',
  pipeLinkPipes_tee_0: 'T, atas, kanan, dan bawah',
  pipeLinkPipes_tee_1: 'T, kanan, bawah, dan kiri',
  pipeLinkPipes_tee_2: 'T, bawah, kiri, dan atas',
  pipeLinkPipes_tee_3: 'T, kiri, atas, dan kanan',
  pipeLinkAnnounce: 'Baris {row}, kolom {col}: {pipes}. {lit} dari {total} ubin terisi.',
  pipeLinkHintNote:
    'Putar ubin di dalam lingkaran titik-titik sampai pipanya cocok dengan pipa yang samar.',
  pipeLinkHintWhere: 'Ditandai: baris {row}, kolom {col}. Putar ke {pipes}.',
  pipeLinkSolvedTitle: 'Semua ubin terisi',
  pipeLinkSolvedBody: 'Air mencapai semua {tiles} ubin.',
  pipeLinkBoardSize: 'Papan',
  pipeLinkHintsUsed: 'Petunjuk terpakai',
  pipeLinkNewBestTime: 'Tercepat sejauh ini.',
  pipeLinkNewBoard: 'Papan baru',
  pipeLinkSolvedCount: 'Papan selesai',
  pipeLinkDailySection: 'Harian',
  pipeLinkDailiesCleared: 'Hari selesai',
  pipeLinkAllModes: 'Semua mode',
  pipeLinkStep1Title: 'Ketuk untuk memutar',
  pipeLinkStep1Body: 'Ketuk ubin untuk memutarnya seperempat putaran searah jarum jam.',
  pipeLinkStep2Title: 'Air mengalir',
  pipeLinkStep2Body: 'Pipa yang terhubung ke sumber terisi air; yang lain tetap kosong.',
  pipeLinkStep3Title: 'Isi semua pipa',
  pipeLinkStep3Body: 'Saat semua pipa penuh, papan selesai.',
};
