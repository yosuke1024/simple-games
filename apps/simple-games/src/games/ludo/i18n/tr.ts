import type { LudoMessages } from './en';

export const tr: LudoMessages = {
  ludoName: 'Ludo',
  ludoChooseOpponent: 'Rakibini seç',
  ludoDifficulty_easy: 'Kolay',
  ludoDifficulty_normal: 'Normal',
  ludoDifficulty_hard: 'Zor',
  ludoRecordNote: '{wins} galibiyet · {losses} mağlubiyet',
  ludoConfirmSwitchTitle: 'Devam eden maç değiştirilsin mi?',
  ludoConfirmSwitchBody: '{current} maçın yeni bir {next} maçıyla değiştirilecek.',

  // ---- the board ----
  ludoBoardLabel: 'Ludo tahtası',
  ludoYou: 'Sen',
  ludoCpu: 'CPU {n}',
  ludoSeatHome: '4 taştan {home} tanesi evde',
  ludoSafeSquare: 'Güvenli kare',
  // Where a pawn is, in words. Composed into the two labels below so a seat, a
  // square and a state are each translated once.
  ludoWhereYard: 'başlangıçta',
  ludoWhereSquare: '{n} numaralı karede',
  ludoWhereSafe: '{n} numaralı güvenli karede',
  ludoWhereColumn: 'bitiş koridorunun {n}. karesinde',
  ludoWhereHome: 'evde',
  ludoPawnAt: '{seat}, {where}',
  ludoMovePawn: '{where} taşını oynat',

  // ---- the die and the turn ----
  ludoRollAction: 'At',
  ludoRollLabel: 'Zar at',
  ludoDieLabel: 'Zar {die} gösteriyor',
  ludoDieUnrolled: 'Zar henüz atılmadı',
  ludoTurnRoll: 'Sıra sende — zarı at.',
  ludoTurnMove: '{die} attın. Oynatmak için bir taşa dokun.',
  ludoTurnCpu: 'CPU {n} oynuyor…',
  ludoAutoPass: 'Bu sayıyla oynatılacak taş yok — sıra geçiyor.',
  ludoThirdSix: 'Art arda üç kez altı geldi — sıra diğerine geçiyor.',
  ludoRollAgain: 'Altı geldi — tekrar at.',

  // ---- the end of a match ----
  ludoWinTitle: 'Kazandın!',
  ludoWinBody: 'Dört taşın da evde.',
  ludoLoseTitle: 'CPU {n} kazandı',
  ludoLoseBody: 'Onun dört taşı da evde. Sonraki maç ücretsiz.',
  ludoNoContestTitle: 'Sonuçsuz',
  ludoNoContestBody:
    'Maç, kimse eve ulaşamadan atış sınırına ulaştı. Oynanmış sayılır ama galibiyet ya da mağlubiyet sayılmaz.',
  ludoWins: 'Galibiyet',
  ludoLosses: 'Mağlubiyet',

  // ---- Quick Rules (docs/LUDO_RULES.md §11) ----
  ludoStep1Title: 'Altı bir taşı çıkarır',
  ludoStep1Body:
    'Zarı at, sonra oynatmak için bir taşa dokun. Yalnızca kuralların izin verdiği taşlara dokunabilirsin — geri kalanlar yerinde kalır.',
  ludoStep2Title: 'Altı tekrar attırır',
  ludoStep2Body:
    'Altı atarsan bir kez daha atarsın. Ama art arda üç altı gelirse, hiçbir taş oynamadan sıra diğerine geçer.',
  ludoStep3Title: 'Rakibin üzerine gelmek onu geri gönderir',
  ludoStep3Body:
    'O karedeki bütün rakip taşları anında kendi başlangıcına döner. Güvenli kareler buna kapalıdır. Taş almak sana ekstra atış kazandırmaz — bunu yalnızca altı yapar.',
  ludoStep4Title: 'Kendi taşlarını üst üste koymak korumaz',
  ludoStep4Body:
    'Aynı karedeki iki taşın kimseyi engellemez, kimseyi korumaz. Bir rakip oraya gelirse yığının tamamı birden başlangıca döner — yığın bir kale değil, hedeftir.',
  ludoStep5Title: 'Eve tam sayıyla girilir',
  ludoStep5Body:
    'Evi aşacak bir atış o taşı hiç oynatmaz. Kazanmak için dört taşını da eve götür. Her sayı maçın seed’inden gelir, altı yüz de eşit olasılıklıdır ve hiçbir oyuncu için zar farklı atılmaz.',
};
