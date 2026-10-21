/**
 * Indonesian catalog for Make the Target — written by AI from the English
 * source on 2026-10-21 (provenance `machine`, docs/MAKE_THE_TARGET_RULES.md
 * §13). No native speaker has read it; it is not to be treated as reviewed.
 * The title (`makeTheTargetName`) is a proper noun and stays as-is in every
 * locale; placeholder names match the English source.
 *
 * Terms: problem = soal, target = sasaran (not gol or skor), solution =
 * solusi, the result of one move = hasil. Division is read "dibagi", left term
 * first. Shared words follow the shell and Bridges (Mudah / Sedang / Sulit,
 * Harian, Hari selesai).
 */
import type { MakeTheTargetMessages } from './en';

export const id: MakeTheTargetMessages = {
  makeTheTargetName: 'Make the Target',
  makeTheTargetChooseTier: 'Pilih tingkat kesulitan',
  makeTheTargetDifficulty_easy: 'Mudah',
  makeTheTargetDifficulty_medium: 'Sedang',
  makeTheTargetDifficulty_hard: 'Sulit',
  makeTheTargetTierNote_easy: '4 angka',
  makeTheTargetTierNote_medium: '4 atau 5 angka',
  makeTheTargetTierNote_hard: '5 angka',
  makeTheTargetConfirmSwitchTitle: 'Ganti soal yang sedang dikerjakan?',
  makeTheTargetConfirmSwitchBody:
    'Soal {current} yang sedang dikerjakan akan diganti dengan soal {next} yang baru.',
  makeTheTargetNumbersLabel: 'Angka',
  makeTheTargetTargetSpoken: 'Sasaran {target}',
  makeTheTargetTargetLabel: 'Sasaran',
  makeTheTargetOperatorsLabel: 'Tanda operasi',
  makeTheTargetOp_add: 'Tambah',
  makeTheTargetOp_subtract: 'Kurang',
  makeTheTargetOp_multiply: 'Kali',
  makeTheTargetOp_divide: 'Bagi',
  makeTheTargetSpokenLine_add: '{left} tambah {right} sama dengan {result}',
  makeTheTargetSpokenLine_subtract: '{left} kurang {right} sama dengan {result}',
  makeTheTargetSpokenLine_multiply: '{left} kali {right} sama dengan {result}',
  makeTheTargetSpokenLine_divide: '{left} dibagi {right} sama dengan {result}',
  makeTheTargetSpokenUndo: 'Diurungkan: {line}',
  makeTheTargetStepsLabel: 'Langkah sejauh ini',
  makeTheTargetMissed: 'Hasilnya {value}, bukan {target}.',
  makeTheTargetSpokenMissed: '{line}. Hasilnya {value}, bukan {target}.',
  makeTheTargetShowSolution: 'Lihat solusi',
  makeTheTargetRevealTitle: 'Lihat satu solusi?',
  makeTheTargetRevealBody: 'Soal ini berakhir di sini dan tidak dihitung sebagai selesai.',
  makeTheTargetRevealConfirm: 'Lihat',
  makeTheTargetSolvedTitle: 'Sasaran tercapai.',
  makeTheTargetRevealedTitle: 'Satu cara membuat {target}',
  makeTheTargetSolutionLabel: 'Satu solusi',
  makeTheTargetNewBoard: 'Soal baru',
  makeTheTargetNewBestTime: 'Tercepat sejauh ini.',
  makeTheTargetSolvedCount: 'Soal selesai',
  makeTheTargetDailySection: 'Harian',
  makeTheTargetDailiesCleared: 'Hari selesai',
  makeTheTargetAllModes: 'Semua mode',
  makeTheTargetStep1Title: 'Gabungkan dua',
  makeTheTargetStep1Body:
    'Ketuk angka, lalu + − × atau ÷, lalu angka lain\u00a0— angka yang diketuk lebih dulu ada di kiri.',
  makeTheTargetStep2Title: 'Angka baru',
  makeTheTargetStep2Body:
    'Keduanya terpakai, dan hasilnya\u00a0— selalu bilangan bulat lebih dari nol\u00a0— menggantikan tempatnya.',
  makeTheTargetStep3Title: 'Capai sasaran',
  makeTheTargetStep3Body:
    'Pakai semua angka. Jika angka terakhir sama dengan sasaran, soal pun selesai.',
};
