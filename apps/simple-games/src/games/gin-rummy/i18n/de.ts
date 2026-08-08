import type { GinRummyMessages } from './en';

export const de: GinRummyMessages = {
  ginName: 'Gin Rummy',

  ginChooseOpponent: 'Gegner wählen',
  ginDifficulty_easy: 'Leicht',
  ginDifficulty_normal: 'Normal',
  ginDifficulty_hard: 'Schwer',
  ginRecordNote: '{wins} Siege · {losses} Niederlagen',
  ginConfirmSwitchTitle: 'Laufende Partie ersetzen?',
  ginConfirmSwitchBody: 'Deine {current}-Partie wird durch eine neue {next}-Partie ersetzt.',

  ginTableLabel: 'Gin-Rummy-Tisch',
  ginHandLabel: 'Dein Blatt',
  ginOpponentLabel: 'Die CPU hält {n} Karten',
  ginStockLabel: 'Talon, {n} Karten',
  ginDiscardLabel: 'Ablagestapel, oben {card}',
  ginDiscardEmpty: 'Ablagestapel, leer',
  ginCardLabel: '{rank} {suit}',
  ginSuit_spades: 'Pik',
  ginSuit_hearts: 'Herz',
  ginSuit_diamonds: 'Karo',
  ginSuit_clubs: 'Kreuz',
  ginCardInMeld: '{card}, Kombination {n}',
  ginCardDeadwood: '{card}, Restkarte',
  ginDeadwood: 'Restpunkte',
  ginYou: 'Du',
  ginCpu: 'CPU',

  ginUpcardPrompt: 'Offene Karte nehmen oder passen',
  ginDrawPrompt: 'Vom Talon oder vom Ablagestapel ziehen',
  ginDiscardPrompt: 'Karte antippen, zum Ablegen erneut antippen',
  ginKnockPrompt: 'Karte zum Klopfen antippen, dann erneut antippen',
  ginCpuTurn: 'Die CPU denkt nach…',
  ginCpuPassed: 'Die CPU hat die offene Karte gepasst',
  ginCpuDrewStock: 'Die CPU hat vom Talon gezogen',
  ginCpuTookDiscard: 'Die CPU hat {card} genommen',
  ginCpuDiscarded: 'Die CPU hat {card} abgelegt',
  ginTake: 'Nehmen',
  ginPass: 'Passen',
  ginKnock: 'Klopfen',

  ginHandGinTitle: 'Gin',
  ginHandKnockTitle: 'Geklopft',
  ginHandUndercutTitle: 'Undercut',
  ginHandDeadTitle: 'Blatt verfallen',
  ginHandDeadBody:
    'Im Talon liegen noch zwei Karten. Niemand punktet, und derselbe Geber gibt erneut.',
  ginHandYouTook: 'Du bekommst {points}',
  ginHandCpuTook: 'Die CPU bekommt {points}',
  ginYourMelds: 'Deine Kombinationen',
  ginCpuMelds: 'Kombinationen der CPU',
  ginLaidOff: 'Angelegt',
  ginNextHand: 'Nächstes Blatt',

  ginWinTitle: 'Du hast gewonnen!',
  ginWinBody: 'Hundert Punkte vor der CPU.',
  ginLoseTitle: 'Die CPU gewinnt',
  ginLoseBody: 'Die CPU war zuerst über hundert. Die nächste Partie ist kostenlos.',

  ginWins: 'Siege',
  ginLosses: 'Niederlagen',

  ginStep1Title: 'Eine ziehen, eine ablegen',
  ginStep1Body:
    'Zieh vom verdeckten Talon oder nimm die oberste Karte des Ablagestapels, dann leg eine andere ab.',
  ginStep2Title: 'Sätze und Folgen',
  ginStep2Body:
    'Drei gleiche Werte oder drei in Folge in einer Farbe — der Rest sind Restpunkte, für dich gezählt.',
  ginStep3Title: 'Klopfen bei zehn oder weniger',
  ginStep3Body:
    'Sobald deine Restpunkte auf zehn oder weniger fallen, erscheint der Klopfen-Knopf und beendet das Blatt.',
};
