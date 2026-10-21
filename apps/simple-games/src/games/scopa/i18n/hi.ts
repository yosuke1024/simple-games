/**
 * Hindi catalog for Scopa.
 *
 * Provenance (docs/SCOPA_RULES.md §12, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI from the English source on 2026-10-21. **No native speaker
 * has read it**, and it is not to be treated as reviewed.
 * The title (`scopaName`) stays “Scopa” in every locale. Terms follow the
 * glossary in §12 (the point / primiera / 7♦ / the ♦ category / cards /
 * take / place / dealer / deal / match):
 * स्कोपा / प्रिमिएरा / 7♦ / ईंट / पत्ते / लेना / रखना / बाँटने वाला / दौर / मैच.
 * Counts stay out of plural forms, as in `en` (“name: number”).
 */
import type { ScopaMessages } from './en';

export const hi: ScopaMessages = {
  scopaName: 'Scopa',

  scopaStep1Title: 'पत्ते लें',
  scopaStep1Body:
    'एक पत्ता चलें: मेज़ से उसी मान का एक पत्ता लें, या वह न हो तो वे पत्ते लें जिनका जोड़ उतना हो।',
  scopaStep2Title: 'रखें, या मेज़ खाली करें',
  scopaStep2Body:
    'जो पत्ता कुछ नहीं लेता, वह मेज़ पर रखा जाता है, और मेज़ के सारे पत्ते ले लेने पर एक अंक मिलता है: स्कोपा।',
  scopaStep3Title: 'ग्यारह पर जीत',
  scopaStep3Body:
    'हर दौर में सबसे ज़्यादा पत्ते, सबसे ज़्यादा ईंट, 7♦ और प्रिमिएरा के लिए एक-एक अंक मिलता है, और 11 या ज़्यादा अंकों के साथ आगे रहने वाला जीतता है।',

  scopaYou: 'आप',
  scopaCpu: 'CPU',
  scopaSuit_spades: 'हुकुम',
  scopaSuit_hearts: 'पान',
  scopaSuit_diamonds: 'ईंट',
  scopaSuit_clubs: 'चिड़ी',
  scopaCardLabel: '{suit} का {face}',

  scopaTableLabel: 'मेज़',
  scopaHandLabel: 'आपके पत्ते',
  scopaHandCanTake: '{card}, ले सकता है',
  scopaHandCannotTake: '{card}, अभी कुछ नहीं ले सकता',
  scopaTableCanTake: '{card}, लिया जा सकता है',
  scopaTableInGroup: '{card}, आपके समूह में',
  scopaPlaceHere: 'यहाँ रखें',
  scopaStockLabel: 'गड्डी में बचे पत्ते: {n}',

  scopaCpuHandLabel: 'CPU के हाथ में पत्ते: {n}',
  scopaBandLabel:
    '{who}: मैच में अंक {score}; इस दौर में: पत्ते {cards}, ईंट {diamonds}, स्कोपा {scopas}{settebello}{dealer}',
  scopaBandSettebello: ', 7♦ पास है',
  scopaBandDealer: ', बाँटने वाला',
  scopaPrimieraLabel: 'आपकी प्रिमिएरा: {total}',
  scopaPrimieraSuit: '{suit}: {card}, {value}',
  scopaPrimieraMissing: '{suit}: अभी कोई नहीं',

  scopaLineYourTurn: 'आपकी बारी: एक पत्ता चलें',
  scopaLineCpuTurn: 'CPU की बारी',
  scopaLineDealing: 'सबको तीन-तीन पत्ते बाँटे जा रहे हैं',
  scopaLinePlace: 'यह कुछ नहीं लेता: इसे रखें, या दूसरा पत्ता चुनें',
  scopaLineTakeOne: 'लेने के लिए फिर टैप करें',
  scopaLineChooseSame: 'चुनें कि कौन-सा पत्ता लेना है',
  scopaLineBuildSum: 'वे पत्ते चुनें जिनका जोड़ {n} हो (अभी {sum})',
  scopaLineCpuTook: 'CPU ने लिया',
  scopaLineCpuPlaced: 'CPU ने रखा',
  scopaLineScopaYou: 'स्कोपा: आपने मेज़ खाली कर दी',
  scopaLineScopaCpu: 'स्कोपा: CPU ने मेज़ खाली कर दी',
  scopaLineSweepYou: 'मेज़ के आख़िरी पत्ते: आपको',
  scopaLineSweepCpu: 'मेज़ के आख़िरी पत्ते: CPU को',
  scopaSayCpuTook: 'CPU ने {card} चला और लिया: {cards}',
  scopaSayCpuPlaced: 'CPU ने {card} रखा',
  scopaSaySweepYou: 'मेज़ पर बचे पत्ते आपको मिले: {cards}',
  scopaSaySweepCpu: 'मेज़ पर बचे पत्ते CPU को मिले: {cards}',

  scopaSayThen: '{first}। {then}',

  scopaDealTitle: 'दौर {n}',
  scopaColCategory: 'श्रेणी',
  scopaColPoint: 'अंक',
  scopaCatCards: 'पत्ते',
  scopaCatDiamonds: 'ईंट',
  scopaCatPrimiera: 'प्रिमिएरा',
  scopaCatScopa: 'स्कोपा',
  scopaPrimieraShort: '{total} (4 में से {suits} सूट)',
  scopaDealPoints: 'यह दौर',
  scopaSweepYou: 'मेज़ पर बचे पत्ते, जो आपने लिए: {n}',
  scopaSweepCpu: 'मेज़ पर बचे पत्ते, जो CPU ने लिए: {n}',
  scopaNextDeal: 'अगला दौर',

  scopaWinTitle: 'आपने मैच जीता',
  scopaLoseTitle: 'CPU ने मैच जीता',
  scopaDecidingDeal: 'आख़िरी दौर',

  scopaRecordNote: 'जीत {wins} · हार {losses}',
  scopaWins: 'जीत',
  scopaLosses: 'हार',
};
