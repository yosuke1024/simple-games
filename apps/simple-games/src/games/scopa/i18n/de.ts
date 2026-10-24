/**
 * German catalog for Scopa.
 *
 * Provenance (docs/SCOPA_RULES.md §12, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI from the English source on 2026-10-21. **No native speaker
 * has read it**, and it is not to be treated as reviewed.
 * The title (`scopaName`) stays “Scopa” in every locale. Terms follow the
 * glossary in §12 (the point / primiera / 7♦ / the ♦ category / cards /
 * take / place / dealer / deal / match):
 * Scopa / Primiera / 7♦ / Karo / Karten / nehmen / legen / Geber / Runde / Partie.
 * Counts stay out of plural forms, as in `en` (“name: number”).
 * The loanwords are capitalised as German nouns (Scopa, Primiera); the
 * informal `du` of the shell and the other card games.
 */
import type { ScopaMessages } from './en';

export const de: ScopaMessages = {
  scopaName: 'Scopa',

  scopaStep1Title: 'Nehmen',
  scopaStep1Body:
    'Spiel eine Karte: Nimm eine Tischkarte mit demselben Wert oder, wenn es keine gibt, Karten, die zusammen diesen Wert ergeben.',
  scopaStep2Title: 'Legen oder abräumen',
  scopaStep2Body:
    'Eine Karte, die nichts nimmt, wird auf den Tisch gelegt, und wer alle Karten vom Tisch nimmt, bekommt einen Punkt: eine Scopa.',
  scopaStep3Title: 'Elf zum Sieg',
  scopaStep3Body:
    'Jede Runde bringt je einen Punkt für die meisten Karten, die meisten Karos, die 7♦ und die Primiera; wer mit 11 oder mehr vorn liegt, gewinnt.',

  scopaYou: 'Du',
  scopaCpu: 'CPU',
  scopaSuit_spades: 'Pik',
  scopaSuit_hearts: 'Herz',
  scopaSuit_diamonds: 'Karo',
  scopaSuit_clubs: 'Kreuz',
  scopaCardLabel: '{face} {suit}',

  scopaTableLabel: 'Tisch',
  scopaHandLabel: 'Dein Blatt',
  scopaHandCanTake: '{card}, kann nehmen',
  scopaHandCannotTake: '{card}, kann jetzt nichts nehmen',
  scopaTableCanTake: '{card}, kann genommen werden',
  scopaTableInGroup: '{card}, in deiner Gruppe',
  scopaPlaceHere: 'Hierhin legen',
  scopaStockLabel: 'Talon: noch {n}',

  scopaCpuHandLabel: 'Karten auf der Hand der CPU: {n}',
  scopaBandLabel:
    '{who}: Stand {score}; diese Runde: Karten {cards}, Karo {diamonds}, Scopa {scopas}{settebello}{dealer}',
  scopaBandSettebello: ', hat die 7♦',
  scopaBandDealer: ', Geber',
  scopaPrimieraLabel: 'Deine Primiera: {total}',
  scopaPrimieraSuit: '{suit}: {card}, {value}',
  scopaPrimieraMissing: '{suit}: noch keine',

  scopaLineYourTurn: 'Du bist dran: spiel eine Karte',
  scopaLineCpuTurn: 'Die CPU ist dran',
  scopaLineDealing: 'Jeder bekommt drei Karten',
  scopaLinePlace: 'Sie nimmt nichts: leg sie hin oder wähl eine andere Karte',
  scopaLineTakeOne: 'Zum Nehmen erneut antippen',
  scopaLineChooseSame: 'Wähl die Karte, die du nimmst',
  scopaLineBuildSum: 'Wähl Karten mit der Summe {n} (bisher {sum})',
  scopaLineCpuTook: 'Die CPU nimmt',
  scopaLineCpuPlaced: 'Die CPU legt',
  scopaLineScopaYou: 'Scopa: du hast den Tisch geleert',
  scopaLineScopaCpu: 'Scopa: die CPU hat den Tisch geleert',
  scopaLineSweepYou: 'Letzte Karten vom Tisch: an dich',
  scopaLineSweepCpu: 'Letzte Karten vom Tisch: an die CPU',
  scopaSayCpuTook: 'Die CPU hat {card} gespielt und {cards} genommen',
  scopaSayCpuPlaced: 'Die CPU hat {card} hingelegt',
  scopaSaySweepYou: 'Du nimmst die restlichen Karten vom Tisch: {cards}',
  scopaSaySweepCpu: 'Die CPU nimmt die restlichen Karten vom Tisch: {cards}',

  scopaSayThen: '{first}. {then}',

  scopaDealTitle: 'Runde {n}',
  scopaColCategory: 'Kategorie',
  scopaColPoint: 'Punkt',
  scopaCatCards: 'Karten',
  scopaCatDiamonds: 'Karo',
  scopaCatPrimiera: 'Primiera',
  scopaCatScopa: 'Scopa',
  scopaPrimieraShort: '{total} ({suits} von 4 Farben)',
  scopaDealPoints: 'Diese Runde',
  scopaSweepYou: 'Restkarten vom Tisch, von dir genommen: {n}',
  scopaSweepCpu: 'Restkarten vom Tisch, von der CPU genommen: {n}',
  scopaNextDeal: 'Nächste Runde',

  scopaWinTitle: 'Du hast die Partie gewonnen',
  scopaLoseTitle: 'Die CPU hat die Partie gewonnen',
  scopaDecidingDeal: 'Die letzte Runde',

  scopaRecordNote: 'Gewonnen {wins} · Verloren {losses}',
  scopaWins: 'Siege',
  scopaLosses: 'Niederlagen',
};
