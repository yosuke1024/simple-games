/**
 * Echo Pads — the Türkçe catalog. Provenance (docs/ECHO_PADS_RULES.md §14):
 * `machine` — written by an AI from the English source on 2026-10-22; nobody
 * has read it, native speaker or author. The title (`echoPadsName`) stays
 * "Echo Pads".
 *
 * Terms (§14's glossary): tuş (pad), dizi (sequence), uzunluk (length), Çal / Yeniden dinle / Durdur, Tempo: Sakin / Orta / Hızlı.
 */
import type { EchoPadsMessages } from './en';

export const tr: EchoPadsMessages = {
  echoPadsName: 'Echo Pads',
  echoPadsTier_4: '4 tuş',
  echoPadsTier_6: '6 tuş',
  echoPadsLength: 'Uzunluk {n}',
  echoPadsLevelDetail: '{tier} · uzunluk {length}',
  echoPadsPace: 'Tempo',
  echoPadsPace_calm: 'Sakin',
  echoPadsPace_normal: 'Orta',
  echoPadsPace_quick: 'Hızlı',
  echoPadsPlay: 'Çal',
  echoPadsListenAgain: 'Yeniden dinle',
  echoPadsStop: 'Durdur',
  echoPadsRound: 'Uzunluk {k} / {target}',
  echoPadsStatusIdle: '{k} tuşu duymak için Çal’a bas.',
  echoPadsStatusPlaying: '{k} tuş çalınıyor…',
  echoPadsStatusYourTurn: 'Sıra sende: {k} tuşa aynı sırayla dokun.',
  echoPadsStatusAgain: '{k} tuşun hepsine ilkinden başlayarak yeniden dokun.',
  echoPadsStatusReview: 'Bu turun {k} tuşu yeniden çalınıyor…',
  echoPadsMark_circle: 'Daire',
  echoPadsMark_triangle: 'Üçgen',
  echoPadsMark_square: 'Kare',
  echoPadsMark_star: 'Yıldız',
  echoPadsMark_diamond: 'Eşkenar dörtgen',
  echoPadsMark_cross: 'Artı',
  echoPadsPos_topLeft: 'sol üst',
  echoPadsPos_topMiddle: 'orta üst',
  echoPadsPos_topRight: 'sağ üst',
  echoPadsPos_bottomLeft: 'sol alt',
  echoPadsPos_bottomMiddle: 'orta alt',
  echoPadsPos_bottomRight: 'sağ alt',
  echoPadsPadLabel: '{mark}, {position}',
  echoPadsPadsLabel: 'Tuşlar',
  echoPadsExpectedLabel: '{pad} (sıradaki tuş)',
  echoPadsMissTitle: 'Oyun {k} uzunluğunda bitti',
  echoPadsMissBody: '{k} tuştan {index}. tuş şuydu: {pad}.',
  echoPadsResultTitle: '{n} tuşun hepsi tekrarlandı',
  echoPadsLongest: 'Tekrarlanan en uzun',
  echoPadsLongestNone: 'Yok',
  echoPadsReplays: 'Yeniden dinleme',
  echoPadsPacesHeard: 'Tempo',
  echoPadsNewSequence: 'Yeni dizi',
  echoPadsLevelCell: '{level}, {detail}',
  echoPadsLevelCellCleared: '{level}, {detail}, geçildi',
  echoPadsReplaceTitle: 'Süren oyun değiştirilsin mi?',
  echoPadsReplaceBody: '{current} oyunu, {next} için yeni bir oyunla değiştirilecek.',
  echoPadsStatStarted: 'Başlanan oyunlar',
  echoPadsStatCleared: 'Geçilen',
  echoPadsStatMissed: 'Hatayla biten',
  echoPadsStatLevels: 'Geçilen seviyeler',
  echoPadsStatDays: 'Tamamlanan günler',
  echoPadsStep1Title: 'Dinle',
  echoPadsStep1Body:
    '▶’a bas, tuşlar teker teker yanıp çalar — sırayı aklında tut (ilk dokunuşuna kadar istediğin kadar yeniden dinleyebilirsin).',
  echoPadsStep2Title: 'Tekrarla',
  echoPadsStep2Body: 'Sonra tuşlara aynı sırayla dokun.',
  echoPadsStep3Title: 'Uzat',
  echoPadsStep3Body: 'Her tekrarladığında sıra bir uzar — süre sınırı yok.',
};
