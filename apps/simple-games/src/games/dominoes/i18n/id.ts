import type { DominoesMessages } from './en';

export const id: DominoesMessages = {
  dominoesName: 'Dominoes',
  dominoesRecordNote: 'Menang {wins} · Kalah {losses}',

  dominoesTileLabel: 'Kartu {a}–{b}',
  dominoesLineLabel: 'Baris permainan: {count} kartu, ujung kiri {left}, ujung kanan {right}',
  dominoesHandLabel: 'Kartu Anda',
  dominoesPlayLeft: 'Pasang di ujung kiri ({value})',
  dominoesPlayRight: 'Pasang di ujung kanan ({value})',
  dominoesCpuShort: 'CPU',
  dominoesBoneyardShort: 'Tumpukan',
  dominoesCpuTiles: 'CPU memegang {count} kartu',
  dominoesBoneyardTiles: 'Tumpukan: {count} kartu',
  dominoesDraw: 'Ambil',
  dominoesPass: 'Lewati',

  dominoesYourTurn: 'Giliran Anda',
  dominoesCpuTurn: 'CPU sedang berpikir…',
  dominoesCpuDrew: 'CPU mengambil satu kartu',
  dominoesCpuPassed: 'CPU melewati gilirannya. Giliran Anda',
  dominoesMustDraw: 'Tidak ada kartu yang cocok. Ambil dari tumpukan',
  dominoesNoTileFits: 'Tidak ada kartu yang cocok dan tumpukan sudah kosong. Lewati',
  dominoesChooseEnd: 'Pilih ujung untuk kartu ini',
  dominoesOpenedYou: 'Anda membuka dengan {tile}',
  dominoesOpenedCpu: 'CPU membuka dengan {tile}. Giliran Anda',

  dominoesWinTitle: 'Anda menang!',
  dominoesWinBodyOut: 'Anda menghabiskan kartu terakhir Anda.',
  dominoesWinBodyBlocked: 'Tidak ada yang bisa jalan, dan mata Anda lebih sedikit.',
  dominoesLoseTitle: 'CPU menang',
  dominoesLoseBodyOut: 'CPU menghabiskan kartu terakhirnya.',
  dominoesLoseBodyBlocked: 'Tidak ada yang bisa jalan, dan mata CPU lebih sedikit.',
  dominoesDrawTitle: 'Seri',
  dominoesDrawBody: 'Tidak ada yang bisa jalan, dan mata sama banyak.',
  dominoesScoreYou: 'Anda mendapat {points} poin',
  dominoesScoreCpu: 'CPU mendapat {points} poin',
  dominoesPipsLeft: 'Sisa mata: Anda {you}, CPU {cpu}',

  dominoesWins: 'Menang',
  dominoesLosses: 'Kalah',
  dominoesDraws: 'Seri',

  dominoesStep1Title: 'Cocokkan salah satu ujung',
  dominoesStep1Body: 'Pasang kartu yang angkanya cocok dengan salah satu ujung terbuka pada baris.',
  dominoesStep2Title: 'Buntu? Ambil kartu',
  dominoesStep2Body:
    'Jika tidak ada kartu yang cocok, ambil dari tumpukan sampai dapat yang cocok. Lewati hanya saat tumpukan kosong.',
  dominoesStep3Title: 'Habiskan lebih dulu',
  dominoesStep3Body:
    'Pasang kartu terakhir Anda untuk menang. Sisa mata di tangan lawan menjadi skor Anda.',
};
