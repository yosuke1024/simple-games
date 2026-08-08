import type { HeartsMessages } from './en';

export const tr: HeartsMessages = {
  heartsName: 'Hearts',

  heartsChooseOpponent: 'Rakiplerini seç',
  heartsDifficulty_easy: 'Kolay',
  heartsDifficulty_normal: 'Normal',
  heartsDifficulty_hard: 'Zor',
  heartsRecordNote: '{wins} galibiyet · {losses} yenilgi · {draws} beraberlik',
  heartsConfirmSwitchTitle: 'Devam eden maç değiştirilsin mi?',
  heartsConfirmSwitchBody: '{current} maçın yeni bir {next} maçıyla değiştirilecek.',

  heartsTableLabel: 'Hearts masası',
  heartsHandLabel: 'Elindeki kartlar',
  heartsTrickLabel: 'Masadaki el',
  heartsTrayLabel: 'Vereceğin kartlar',
  heartsYou: 'Sen',
  heartsCpuSeat: 'CPU {n}',
  heartsYouLabel: 'Sen: bu turda {hand} puan, maçta {total} puan',
  heartsSeatLabel: 'CPU {n}: {cards} kart, bu turda {hand} puan, maçta {total} puan',
  heartsTookLastTrick: 'Son eli aldı',
  heartsCardLabel: '{suit} {rank}',
  heartsSuit_spades: 'maça',
  heartsSuit_hearts: 'kupa',
  heartsSuit_diamonds: 'karo',
  heartsSuit_clubs: 'sinek',
  heartsCardBlocked: '{card}, şimdi oynanamaz',
  heartsCardChosen: '{card}, vermek için seçildi',
  heartsTrickCard: '{card}, {seat}',

  heartsPassPrompt: 'Vermek için üç kart seç',
  heartsPassLeft: 'Soldakine veriliyor',
  heartsPassAcross: 'Karşıdakine veriliyor',
  heartsPassRight: 'Sağdakine veriliyor',
  heartsPassConfirm: 'Bu üçünü ver',
  heartsPassWaiting: 'Diğer oyuncular bekleniyor…',

  heartsPlayPrompt: 'Bir karta dokun, oynamak için tekrar dokun',
  heartsCpuTurn: 'CPU {n} oynuyor…',
  heartsTrickYou: 'Eli sen aldın',
  heartsTrickCpu: 'Eli CPU {n} aldı',

  heartsHandTitle: 'Tur hesabı',
  heartsMoonTitle: 'Hepsini topladı',
  heartsMoonYou: 'Yirmi altı puanın hepsini sen aldın, bu yüzden diğer üç oyuncu 26’şar puan alır.',
  heartsMoonCpu: 'Yirmi altı puanın hepsini CPU {n} aldı, bu yüzden diğer herkes 26 puan alır.',
  heartsThisHand: 'Bu tur',
  heartsMatchTotal: 'Maç',
  heartsNextHand: 'Sonraki tur',

  heartsWinTitle: 'Kazandın!',
  heartsWinBody: 'Biri yüz puanı geçtiğinde en az puan sendeydi.',
  heartsLoseTitle: 'CPU kazandı',
  heartsLoseBody: 'Başka bir oyuncu daha az puanla bitirdi. Sonraki maç ücretsiz.',
  heartsDrawTitle: 'Beraberlik',
  heartsDrawBody: 'En düşük puanda başka bir oyuncuyla eşit bitirdin.',
  heartsFinalScores: 'Son puanlar',

  heartsWins: 'Galibiyet',
  heartsLosses: 'Yenilgi',
  heartsDraws: 'Beraberlik',

  heartsStep1Title: 'Üç kart ver',
  heartsStep1Body:
    'Turların çoğu, üç kart seçip vermekle başlar — önce soldakine, sonra sağdakine, sonra karşıdakine, sonra da kimsenin vermediği bir tur.',
  heartsStep2Title: 'Aynı renkten oyna',
  heartsStep2Body:
    'İlk kartı oynayan rengi belirler; o renkten kartın varsa onu oynamalısın ve o rengin en büyüğü eli alır.',
  heartsStep3Title: 'En az puan kazanır',
  heartsStep3Body:
    'Aldığın her kupa bir puan, maça kızı ise on üç puandır; biri yüz puanı geçtiğinde en az puanı olan kazanır.',
};
