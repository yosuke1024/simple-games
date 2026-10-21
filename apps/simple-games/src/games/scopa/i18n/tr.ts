/**
 * Turkish catalog for Scopa.
 *
 * Provenance (docs/SCOPA_RULES.md §12, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI from the English source on 2026-10-21. **No native speaker
 * has read it**, and it is not to be treated as reviewed.
 * The title (`scopaName`) stays “Scopa” in every locale. Terms follow the
 * glossary in §12 (the point / primiera / 7♦ / the ♦ category / cards /
 * take / place / dealer / deal / match):
 * scopa / primiera / 7♦ / karo / kart / almak / koymak / dağıtan / tur / maç.
 * Counts stay out of plural forms, as in `en` (“name: number”).
 * The point is never called “pişti”: a different game with its own
 * capture rule.
 */
import type { ScopaMessages } from './en';

export const tr: ScopaMessages = {
  scopaName: 'Scopa',

  scopaStep1Title: 'Al',
  scopaStep1Body:
    'Bir kart oyna: masadan aynı değerde bir kart al, yoksa toplamı o değeri veren kartları al.',
  scopaStep2Title: 'Koy ya da masayı boşalt',
  scopaStep2Body:
    'Hiçbir şey almayan kart masaya konur; masadaki bütün kartları almak ise bir puan getirir: scopa.',
  scopaStep3Title: 'On bir puanla kazan',
  scopaStep3Body:
    'Her tur en çok kart, en çok karo, 7♦ ve primiera için birer puan verir; 11 veya daha fazlayla önde olan kazanır.',

  scopaYou: 'Sen',
  scopaCpu: 'CPU',
  scopaSuit_spades: 'maça',
  scopaSuit_hearts: 'kupa',
  scopaSuit_diamonds: 'karo',
  scopaSuit_clubs: 'sinek',
  scopaCardLabel: '{suit} {face}',

  scopaTableLabel: 'Masa',
  scopaHandLabel: 'Elindeki kartlar',
  scopaHandCanTake: '{card}, alabilir',
  scopaHandCannotTake: '{card}, şimdi alamaz',
  scopaTableCanTake: '{card}, alınabilir',
  scopaTableInGroup: '{card}, grubunda',
  scopaPlaceHere: 'Buraya koy',
  scopaStockLabel: 'Destede kalan: {n}',

  scopaCpuHandLabel: 'CPU’nun elindeki kartlar: {n}',
  scopaBandLabel:
    '{who}: puan {score}; bu tur: kart {cards}, karo {diamonds}, scopa {scopas}{settebello}{dealer}',
  scopaBandSettebello: ', 7♦ var',
  scopaBandDealer: ', dağıtan',
  scopaPrimieraLabel: 'Senin primieran: {total}',
  scopaPrimieraSuit: '{suit}: {card}, {value}',
  scopaPrimieraMissing: '{suit}: henüz yok',

  scopaLineYourTurn: 'Sıra sende: bir kart oyna',
  scopaLineCpuTurn: 'Sıra CPU’da',
  scopaLineDealing: 'Herkese üçer kart dağıtılıyor',
  scopaLinePlace: 'Hiçbir şey almıyor: koy ya da başka bir kart seç',
  scopaLineTakeOne: 'Almak için yine dokun',
  scopaLineChooseSame: 'Hangi kartı alacağını seç',
  scopaLineBuildSum: 'Toplamı {n} olan kartları seç (şimdilik {sum})',
  scopaLineCpuTook: 'CPU aldı',
  scopaLineCpuPlaced: 'CPU koydu',
  scopaLineScopaYou: 'Scopa: masayı boşalttın',
  scopaLineScopaCpu: 'Scopa: CPU masayı boşalttı',
  scopaLineSweepYou: 'Masada kalan son kartlar: sana',
  scopaLineSweepCpu: 'Masada kalan son kartlar: CPU’ya',
  scopaSayCpuTook: 'CPU {card} oynadı ve aldı: {cards}',
  scopaSayCpuPlaced: 'CPU {card} koydu',
  scopaSaySweepYou: 'Masada kalan kartları sen alıyorsun: {cards}',
  scopaSaySweepCpu: 'Masada kalan kartları CPU alıyor: {cards}',

  scopaSayThen: '{first}. {then}',

  scopaDealTitle: 'Tur {n}',
  scopaColCategory: 'Kategori',
  scopaColPoint: 'Puan',
  scopaCatCards: 'Kart',
  scopaCatDiamonds: 'Karo',
  scopaCatPrimiera: 'Primiera',
  scopaCatScopa: 'Scopa',
  scopaPrimieraShort: '{total} (4 renkten {suits})',
  scopaDealPoints: 'Bu tur',
  scopaSweepYou: 'Masada kalan, senin aldığın kartlar: {n}',
  scopaSweepCpu: 'Masada kalan, CPU’nun aldığı kartlar: {n}',
  scopaNextDeal: 'Sonraki tur',

  scopaWinTitle: 'Maçı sen kazandın',
  scopaLoseTitle: 'Maçı CPU kazandı',
  scopaDecidingDeal: 'Son tur',

  scopaRecordNote: 'Galibiyet {wins} · Yenilgi {losses}',
  scopaWins: 'Galibiyet',
  scopaLosses: 'Yenilgi',
};
