/**
 * id catalog for Binary Balance: a machine translation of the English
 * source, not yet reviewed by a native speaker (docs/I18N_POLICY.md). The
 * title (`binaryBalanceName`) is a proper noun and stays as-is; wording follows
 * the Takuzu catalog where the meaning is the same. The two marks are a sun
 * and a moon (the ordinary words for the celestial bodies).
 */
import type { BinaryBalanceMessages } from './en';

export const id: BinaryBalanceMessages = {
  binaryBalanceName: 'Binary Balance',
  binaryBalanceChooseBoard: 'Pilih papan',
  binaryBalanceDifficulty_easy: 'Mudah',
  binaryBalanceDifficulty_medium: 'Sedang',
  binaryBalanceDifficulty_hard: 'Sulit',
  binaryBalanceBoardNote: '{size}×{size}',
  binaryBalanceConfirmSwitchTitle: 'Ganti papan yang sedang berjalan?',
  binaryBalanceConfirmSwitchBody:
    'Permainan {current} milikmu akan diganti dengan papan {next} yang baru.',
  binaryBalanceBoardLabel: 'Papan Binary Balance, {size}×{size}',
  binaryBalanceCellEmpty: 'Kosong, baris {row}, kolom {col}',
  binaryBalanceCellSun: 'Matahari, baris {row}, kolom {col}',
  binaryBalanceCellMoon: 'Bulan, baris {row}, kolom {col}',
  binaryBalanceCellFixedSun: 'Matahari awal, baris {row}, kolom {col}',
  binaryBalanceCellFixedMoon: 'Bulan awal, baris {row}, kolom {col}',
  binaryBalanceLinkSameRight: 'sama dengan kotak di kanan',
  binaryBalanceLinkDiffRight: 'berbeda dari kotak di kanan',
  binaryBalanceLinkSameBelow: 'sama dengan kotak di bawah',
  binaryBalanceLinkDiffBelow: 'berbeda dari kotak di bawah',
  binaryBalanceRuleBroken: 'melanggar aturan',
  binaryBalanceMarkSun: 'matahari',
  binaryBalanceMarkMoon: 'bulan',
  binaryBalanceHintViolation: 'Kotak yang disorot melanggar aturan.',
  binaryBalanceHintWrong: 'Tanda yang diberi garis tepi tidak mungkin benar.',
  binaryBalanceHintPairGap:
    'Pasangan berwarna akan membuat tiga berturut-turut, jadi kotak bergaris tepi adalah {mark}.',
  binaryBalanceHintLineCount:
    'Baris atau kolom yang disorot sudah memuat separuh dari tanda berwarna, jadi kotak bergaris tepi adalah {mark}.',
  binaryBalanceHintLinkSame:
    'Tanda = menghubungkan kotak bergaris tepi dengan kotak berwarna, jadi ini juga {mark}.',
  binaryBalanceHintLinkDiff:
    'Tanda × menghubungkan kotak bergaris tepi dengan kotak berwarna, jadi isinya tanda yang lain: {mark}.',
  binaryBalanceHintLineCompletion:
    'Semua cara melengkapi baris atau kolom yang disorot menaruh {mark} di kotak bergaris tepi.',
  binaryBalanceHintHypothesis:
    'Jika kotak bergaris tepi berisi {other}, langkah berikutnya akan melanggar aturan, jadi isinya {mark}.',
  binaryBalanceHintNone: 'Belum ada langkah pasti saat ini.',
  binaryBalanceSolvedTitle: 'Selesai!',
  binaryBalanceSolvedBody: 'Setiap baris dan kolom seimbang, dan setiap tautan terpenuhi.',
  binaryBalanceHintsUsed: 'Petunjuk terpakai',
  binaryBalanceNewBestTime: 'Waktu tercepatmu.',
  binaryBalanceNewBoard: 'Papan baru',
  binaryBalanceDailySection: 'Harian',
  binaryBalanceDailiesSolved: 'Hari terselesaikan',
  binaryBalanceStep1Title: 'Jangan tiga berturut-turut',
  binaryBalanceStep1Body:
    'Ketuk untuk berganti antara kosong, matahari, bulan. Tanda yang sama tidak boleh tiga berturut-turut.',
  binaryBalanceStep2Title: 'Setengah-setengah',
  binaryBalanceStep2Body: 'Setiap baris dan setiap kolom berisi matahari dan bulan sama banyak.',
  binaryBalanceStep3Title: 'Ikuti tautannya',
  binaryBalanceStep3Body:
    'Kotak yang dihubungkan = sama; kotak yang dihubungkan × berbeda. Buntu? Minta petunjuk.',
};
