/**
 * Echo Pads — the français catalog. Provenance (docs/ECHO_PADS_RULES.md §14):
 * `machine` — written by an AI from the English source on 2026-10-22; nobody
 * has read it, native speaker or author. The title (`echoPadsName`) stays
 * "Echo Pads".
 *
 * Terms (§14's glossary): touche (pad), séquence, longueur, Écouter / Réécouter / Arrêter, Rythme : Calme / Moyen / Rapide.
 */
import type { EchoPadsMessages } from './en';

export const fr: EchoPadsMessages = {
  echoPadsName: 'Echo Pads',
  echoPadsTier_4: '4 touches',
  echoPadsTier_6: '6 touches',
  echoPadsLength: 'Longueur {n}',
  echoPadsLevelDetail: '{tier} · longueur {length}',
  echoPadsPace: 'Rythme',
  echoPadsPace_calm: 'Calme',
  echoPadsPace_normal: 'Moyen',
  echoPadsPace_quick: 'Rapide',
  echoPadsPlay: 'Écouter',
  echoPadsListenAgain: 'Réécouter',
  echoPadsStop: 'Arrêter',
  echoPadsRound: 'Longueur {k} sur {target}',
  echoPadsStatusIdle: 'Appuyez sur Écouter pour entendre {k} touches.',
  echoPadsStatusPlaying: 'Lecture de {k} touches…',
  echoPadsStatusYourTurn: 'À vous : touchez les {k} touches dans le même ordre.',
  echoPadsStatusAgain: 'Touchez à nouveau les {k} touches, depuis la première.',
  echoPadsStatusReview: 'Nouvelle lecture des {k} touches de cette manche…',
  echoPadsMark_circle: 'Cercle',
  echoPadsMark_triangle: 'Triangle',
  echoPadsMark_square: 'Carré',
  echoPadsMark_star: 'Étoile',
  echoPadsMark_diamond: 'Losange',
  echoPadsMark_cross: 'Croix',
  echoPadsPos_topLeft: 'en haut à gauche',
  echoPadsPos_topMiddle: 'en haut au milieu',
  echoPadsPos_topRight: 'en haut à droite',
  echoPadsPos_bottomLeft: 'en bas à gauche',
  echoPadsPos_bottomMiddle: 'en bas au milieu',
  echoPadsPos_bottomRight: 'en bas à droite',
  echoPadsPadLabel: '{mark}, {position}',
  echoPadsPadsLabel: 'Touches',
  echoPadsExpectedLabel: '{pad} (la touche qui venait ensuite)',
  echoPadsMissTitle: 'La partie s’est arrêtée à la longueur {k}',
  echoPadsMissBody: 'La touche {index} sur {k} était : {pad}.',
  echoPadsResultTitle: 'Les {n} rendues',
  echoPadsLongest: 'Plus longue rendue',
  echoPadsLongestNone: 'Aucune',
  echoPadsReplays: 'Réécoutes',
  echoPadsPacesHeard: 'Rythme',
  echoPadsNewSequence: 'Nouvelle séquence',
  echoPadsLevelCell: '{level}, {detail}',
  echoPadsLevelCellCleared: '{level}, {detail}, réussi',
  echoPadsReplaceTitle: 'Remplacer la partie en cours ?',
  echoPadsReplaceBody: 'La partie de {current} sera remplacée par une nouvelle partie de {next}.',
  echoPadsStatStarted: 'Parties commencées',
  echoPadsStatCleared: 'Réussies',
  echoPadsStatMissed: 'Terminées par une erreur',
  echoPadsStatLevels: 'Niveaux réussis',
  echoPadsStatDays: 'Jours terminés',
  echoPadsStep1Title: 'Écoutez',
  echoPadsStep1Body:
    'Appuyez sur ▶ : les touches s’allument et sonnent une à une — retenez l’ordre (avant votre première touche, vous pouvez réécouter autant de fois que vous voulez).',
  echoPadsStep2Title: 'Répétez',
  echoPadsStep2Body: 'Touchez ensuite les touches dans le même ordre.',
  echoPadsStep3Title: 'Allongez',
  echoPadsStep3Body: 'À chaque ordre rendu, il s’allonge d’une touche — sans limite de temps.',
};
