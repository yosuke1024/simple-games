/**
 * Echo Pads — the Deutsch catalog. Provenance (docs/ECHO_PADS_RULES.md §14):
 * `machine` — written by an AI from the English source on 2026-10-22; nobody
 * has read it, native speaker or author. The title (`echoPadsName`) stays
 * "Echo Pads".
 *
 * Terms (§14's glossary): Feld (pad), Folge (sequence), Länge (length), Abspielen / Noch einmal hören / Stopp, Tempo: Ruhig / Mittel / Schnell.
 */
import type { EchoPadsMessages } from './en';

export const de: EchoPadsMessages = {
  echoPadsName: 'Echo Pads',
  echoPadsTier_4: '4 Felder',
  echoPadsTier_6: '6 Felder',
  echoPadsLength: 'Länge {n}',
  echoPadsLevelDetail: '{tier} · Länge {length}',
  echoPadsPace: 'Tempo',
  echoPadsPace_calm: 'Ruhig',
  echoPadsPace_normal: 'Mittel',
  echoPadsPace_quick: 'Schnell',
  echoPadsPlay: 'Abspielen',
  echoPadsListenAgain: 'Noch einmal hören',
  echoPadsStop: 'Stopp',
  echoPadsRound: 'Länge {k} von {target}',
  echoPadsStatusIdle: 'Tippe auf Abspielen, um {k} Felder zu hören.',
  echoPadsStatusPlaying: '{k} Felder werden abgespielt …',
  echoPadsStatusYourTurn: 'Du bist dran: Tippe die {k} Felder in derselben Reihenfolge.',
  echoPadsStatusAgain: 'Tippe alle {k} Felder noch einmal, ab dem ersten.',
  echoPadsStatusReview: 'Die {k} Felder dieser Runde werden noch einmal abgespielt …',
  echoPadsMark_circle: 'Kreis',
  echoPadsMark_triangle: 'Dreieck',
  echoPadsMark_square: 'Quadrat',
  echoPadsMark_star: 'Stern',
  echoPadsMark_diamond: 'Raute',
  echoPadsMark_cross: 'Kreuz',
  echoPadsPos_topLeft: 'oben links',
  echoPadsPos_topMiddle: 'oben Mitte',
  echoPadsPos_topRight: 'oben rechts',
  echoPadsPos_bottomLeft: 'unten links',
  echoPadsPos_bottomMiddle: 'unten Mitte',
  echoPadsPos_bottomRight: 'unten rechts',
  echoPadsPadLabel: '{mark}, {position}',
  echoPadsPadsLabel: 'Felder',
  echoPadsExpectedLabel: '{pad} (das Feld, das als Nächstes kam)',
  echoPadsMissTitle: 'Der Lauf endete bei Länge {k}',
  echoPadsMissBody: 'Feld {index} von {k} war: {pad}.',
  echoPadsResultTitle: 'Alle {n} wiedergegeben',
  echoPadsLongest: 'Längste wiedergegeben',
  echoPadsLongestNone: 'Keine',
  echoPadsReplays: 'Noch einmal gehört',
  echoPadsPacesHeard: 'Tempo',
  echoPadsNewSequence: 'Neue Folge',
  echoPadsLevelCell: '{level}, {detail}',
  echoPadsLevelCellCleared: '{level}, {detail}, geschafft',
  echoPadsReplaceTitle: 'Laufenden Lauf ersetzen?',
  echoPadsReplaceBody: 'Der Lauf in {current} wird durch einen neuen Lauf in {next} ersetzt.',
  echoPadsStatStarted: 'Begonnene Läufe',
  echoPadsStatCleared: 'Geschafft',
  echoPadsStatMissed: 'Durch einen Fehler beendet',
  echoPadsStatLevels: 'Geschaffte Level',
  echoPadsStatDays: 'Abgeschlossene Tage',
  echoPadsStep1Title: 'Zuhören',
  echoPadsStep1Body:
    'Tippe auf ▶, dann leuchten und klingen die Felder nacheinander – merk dir die Reihenfolge (bis zum ersten Tippen kannst du beliebig oft noch einmal hören).',
  echoPadsStep2Title: 'Wiederholen',
  echoPadsStep2Body: 'Tippe die Felder dann in derselben Reihenfolge.',
  echoPadsStep3Title: 'Wachsen',
  echoPadsStep3Body:
    'Jedes Mal, wenn du sie wiedergibst, wird die Reihenfolge um eins länger – ohne Zeitlimit.',
};
