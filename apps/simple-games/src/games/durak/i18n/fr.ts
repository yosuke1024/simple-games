import type { DurakMessages } from './en';
export const fr: DurakMessages = {
  durakPlayed: 'Parties commencées',
  durakFinished: 'Parties terminées',
  durakWins: 'Victoires',
  durakYou: 'Vous',
  durakCpu: 'CPU {n}',
  durakCards: '{n} cartes',
  durakField: 'Table de cartes',
  durakHand: 'Votre main',
  durakYourTurn: 'À vous de jouer',
  durakTurn: '{name} joue…',
  durakJoker: 'Joker',
  durakCard: '{rank} {suit}',
  durakDraws: 'Matchs nuls',
  durakWon: 'Vous avez gagné !',
  durakLost: 'Partie terminée',
  durakDraw: 'Égalité',
  durakName: 'Dourak',
  durakIntro: 'Repoussez l’attaque, puis inversez les rôles.',
  durakRules: '2 places · 36 cartes · 6 chacun · L’atout bat les autres couleurs.',
  durakStep1Title: 'Attaquez avec une carte',
  durakStep1Body:
    'L’attaquant commence par une carte, puis peut ajouter des valeurs déjà sur la table.',
  durakStep2Title: 'Défendez ou ramassez',
  durakStep2Body:
    'Battez chaque attaque avec une carte supérieure de même couleur ou un atout, sinon ramassez la table.',
  durakStep3Title: 'Débarrassez-vous des cartes',
  durakStep3Body:
    'Complétez à six après chaque attaque ; pioche épuisée, évitez de garder les dernières cartes.',
  durakTrump: 'Atout : {suit}',
  durakStockCount: 'Pioche : {n}',
  durakAttackHint:
    'Attaquez avec une carte encadrée ; après la défense, ajoutez une valeur présente ou terminez.',
  durakDefendHint: 'Battez l’attaque encore découverte ou ramassez toutes les cartes.',
  durakTaking:
    'Ramassage choisi ; l’attaquant peut ajouter des valeurs présentes avant de terminer.',
  durakConfirmTake: 'Confirmer le ramassage',
  durakDone: 'Finir l’attaque',
  durakTake: 'Ramasser',
} as const;
