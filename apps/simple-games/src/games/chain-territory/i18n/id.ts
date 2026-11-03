// AI translation; not reviewed by a native speaker.
import type { ChainTerritoryMessages } from './en';
export const id: ChainTerritoryMessages = {
  chainTerritoryName: 'Chain Territory',
  chainTerritoryBest: 'Langkah menang tersedikit',
  chainTerritoryWins: 'Kemenangan',
  chainTerritoryWon: 'Anda menang!',
  chainTerritoryLost: 'CPU menang',
  chainTerritoryYou: 'Anda',
  chainTerritoryCpu: 'CPU',
  chainTerritoryEmpty: 'Kosong',
  chainTerritoryField: 'Papan reaksi berantai',
  chainTerritoryCell: 'Baris {row}, kolom {col}: {owner}, {n} dari {max}',
  chainTerritoryTurn: 'Tambahkan bola di petak kosong atau milik Anda.',
  chainTerritoryThinking: 'CPU sedang berpikir…',
  chainTerritoryChain: 'Reaksi berantai menyebar…',
  chainTerritoryCapacity: 'Sudut: 2 · Tepi: 3 · Tengah: 4',
  chainTerritoryStep1Title: 'Letakkan bola',
  chainTerritoryStep1Body:
    'Bergiliran dengan CPU. Tambahkan satu bola di petak kosong atau milik Anda.',
  chainTerritoryStep2Title: 'Mulai rantai',
  chainTerritoryStep2Body:
    'Saat mencapai 2 di sudut, 3 di tepi, atau 4 di tengah, bola menyebar dan merebut petak tetangga.',
  chainTerritoryStep3Title: 'Rebut semua bola lawan',
  chainTerritoryStep3Body:
    'Setelah keduanya bergerak sekali, rebut semua bola CPU untuk menang. Urungkan membatalkan langkah Anda dan balasannya.',
  chainTerritoryMode_easy: 'Mudah',
  chainTerritoryMode_normal: 'Normal',
  chainTerritoryMode_hard: 'Sulit',
};
