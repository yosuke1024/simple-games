/**
 * Indonesian catalog for Scopa.
 *
 * Provenance (docs/SCOPA_RULES.md §12, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI from the English source on 2026-10-21. **No native speaker
 * has read it**, and it is not to be treated as reviewed.
 * The title (`scopaName`) stays “Scopa” in every locale. Terms follow the
 * glossary in §12 (the point / primiera / 7♦ / the ♦ category / cards /
 * take / place / dealer / deal / match):
 * scopa / primiera / 7♦ / wajik / kartu / ambil / letakkan / pembagi / ronde / pertandingan.
 * Counts stay out of plural forms, as in `en` (“name: number”).
 */
import type { ScopaMessages } from './en';

export const id: ScopaMessages = {
  scopaName: 'Scopa',

  scopaStep1Title: 'Ambil',
  scopaStep1Body:
    'Mainkan satu kartu: ambil kartu meja yang nilainya sama, atau jika tidak ada, kartu-kartu yang jumlahnya sama dengan nilai itu.',
  scopaStep2Title: 'Letakkan, atau kosongkan meja',
  scopaStep2Body:
    'Kartu yang tidak mengambil apa pun diletakkan di meja, dan mengambil semua kartu di meja memberi satu poin: scopa.',
  scopaStep3Title: 'Sebelas untuk menang',
  scopaStep3Body:
    'Setiap ronde memberi satu poin untuk kartu terbanyak, wajik terbanyak, 7♦, dan primiera; yang mencapai 11 atau lebih sambil unggul akan menang.',

  scopaYou: 'Anda',
  scopaCpu: 'CPU',
  scopaSuit_spades: 'sekop',
  scopaSuit_hearts: 'hati',
  scopaSuit_diamonds: 'wajik',
  scopaSuit_clubs: 'keriting',
  scopaCardLabel: '{face} {suit}',

  scopaTableLabel: 'Meja',
  scopaHandLabel: 'Kartu Anda',
  scopaHandCanTake: '{card}, bisa mengambil',
  scopaHandCannotTake: '{card}, belum bisa mengambil',
  scopaTableCanTake: '{card}, bisa diambil',
  scopaTableInGroup: '{card}, dalam kelompok Anda',
  scopaPlaceHere: 'Letakkan di sini',
  scopaStockLabel: 'Sisa tumpukan: {n}',

  scopaCpuHandLabel: 'Kartu di tangan CPU: {n}',
  scopaBandLabel:
    '{who}: skor {score}; ronde ini: kartu {cards}, wajik {diamonds}, scopa {scopas}{settebello}{dealer}',
  scopaBandSettebello: ', memegang 7♦',
  scopaBandDealer: ', pembagi',
  scopaPrimieraLabel: 'Primiera Anda: {total}',
  scopaPrimieraSuit: '{suit}: {card}, {value}',
  scopaPrimieraMissing: '{suit}: belum ada',

  scopaLineYourTurn: 'Giliran Anda: mainkan satu kartu',
  scopaLineCpuTurn: 'Giliran CPU',
  scopaLineDealing: 'Membagikan tiga kartu untuk masing-masing',
  scopaLinePlace: 'Tidak mengambil apa pun: letakkan, atau pilih kartu lain',
  scopaLineTakeOne: 'Ketuk lagi untuk mengambil',
  scopaLineChooseSame: 'Pilih kartu yang akan diambil',
  scopaLineBuildSum: 'Pilih kartu yang jumlahnya {n} (sejauh ini {sum})',
  scopaLineCpuTook: 'CPU mengambil',
  scopaLineCpuPlaced: 'CPU meletakkan',
  scopaLineScopaYou: 'Scopa: Anda mengosongkan meja',
  scopaLineScopaCpu: 'Scopa: CPU mengosongkan meja',
  scopaLineSweepYou: 'Kartu terakhir di meja: untuk Anda',
  scopaLineSweepCpu: 'Kartu terakhir di meja: untuk CPU',
  scopaSayCpuTook: 'CPU memainkan {card} dan mengambil {cards}',
  scopaSayCpuPlaced: 'CPU meletakkan {card}',
  scopaSaySweepYou: 'Anda mengambil kartu yang tersisa di meja: {cards}',
  scopaSaySweepCpu: 'CPU mengambil kartu yang tersisa di meja: {cards}',

  scopaSayThen: '{first}. {then}',

  scopaDealTitle: 'Ronde {n}',
  scopaColCategory: 'Kategori',
  scopaColPoint: 'Poin',
  scopaCatCards: 'Kartu',
  scopaCatDiamonds: 'Wajik',
  scopaCatPrimiera: 'Primiera',
  scopaCatScopa: 'Scopa',
  scopaPrimieraShort: '{total} ({suits} dari 4 jenis)',
  scopaDealPoints: 'Ronde ini',
  scopaSweepYou: 'Sisa kartu di meja, diambil Anda: {n}',
  scopaSweepCpu: 'Sisa kartu di meja, diambil CPU: {n}',
  scopaNextDeal: 'Ronde berikutnya',

  scopaWinTitle: 'Anda memenangkan pertandingan',
  scopaLoseTitle: 'CPU memenangkan pertandingan',
  scopaDecidingDeal: 'Ronde terakhir',

  scopaRecordNote: 'Menang {wins} · Kalah {losses}',
  scopaWins: 'Menang',
  scopaLosses: 'Kalah',
};
