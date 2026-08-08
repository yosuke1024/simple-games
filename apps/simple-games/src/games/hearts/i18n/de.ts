import type { HeartsMessages } from './en';

export const de: HeartsMessages = {
  heartsName: 'Hearts',

  heartsChooseOpponent: 'Gegner wählen',
  heartsDifficulty_easy: 'Leicht',
  heartsDifficulty_normal: 'Normal',
  heartsDifficulty_hard: 'Schwer',
  heartsRecordNote: '{wins} Siege · {losses} Niederlagen · {draws} Unentschieden',
  heartsConfirmSwitchTitle: 'Laufende Partie ersetzen?',
  heartsConfirmSwitchBody: 'Deine {current}-Partie wird durch eine neue {next}-Partie ersetzt.',

  heartsTableLabel: 'Hearts-Tisch',
  heartsHandLabel: 'Dein Blatt',
  heartsTrickLabel: 'Der Stich',
  heartsTrayLabel: 'Karten, die du weitergibst',
  heartsYou: 'Du',
  heartsCpuSeat: 'CPU {n}',
  heartsYouLabel: 'Du: {hand} Punkte in dieser Runde, {total} in der Partie',
  heartsSeatLabel: 'CPU {n}: {cards} Karten, {hand} Punkte in dieser Runde, {total} in der Partie',
  heartsTookLastTrick: 'Hat den letzten Stich genommen',
  heartsCardLabel: '{rank} {suit}',
  heartsSuit_spades: 'Pik',
  heartsSuit_hearts: 'Herz',
  heartsSuit_diamonds: 'Karo',
  heartsSuit_clubs: 'Kreuz',
  heartsCardBlocked: '{card}, jetzt nicht spielbar',
  heartsCardChosen: '{card}, zum Weitergeben gewählt',
  heartsTrickCard: '{card}, {seat}',

  heartsPassPrompt: 'Wähle drei Karten zum Weitergeben',
  heartsPassLeft: 'Weitergabe nach links',
  heartsPassAcross: 'Weitergabe nach gegenüber',
  heartsPassRight: 'Weitergabe nach rechts',
  heartsPassConfirm: 'Diese drei weitergeben',
  heartsPassWaiting: 'Warten auf die anderen Plätze…',

  heartsPlayPrompt: 'Karte antippen, zum Ausspielen erneut antippen',
  heartsCpuTurn: 'CPU {n} spielt…',
  heartsTrickYou: 'Du hast den Stich genommen',
  heartsTrickCpu: 'CPU {n} hat den Stich genommen',

  heartsHandTitle: 'Runde abgerechnet',
  heartsMoonTitle: 'Durchmarsch',
  heartsMoonYou:
    'Du hast alle sechsundzwanzig Punkte genommen, also bekommen die anderen drei Plätze je 26.',
  heartsMoonCpu:
    'CPU {n} hat alle sechsundzwanzig Punkte genommen, also bekommen alle anderen je 26.',
  heartsThisHand: 'Diese Runde',
  heartsMatchTotal: 'Partie',
  heartsNextHand: 'Nächste Runde',

  heartsWinTitle: 'Du hast gewonnen!',
  heartsWinBody: 'Die wenigsten Punkte, als jemand über hundert kam.',
  heartsLoseTitle: 'Die CPU gewinnt',
  heartsLoseBody:
    'Ein anderer Platz hat mit weniger Punkten beendet. Die nächste Partie ist kostenlos.',
  heartsDrawTitle: 'Unentschieden',
  heartsDrawBody: 'Du hast mit einem anderen Platz gleichauf die wenigsten Punkte.',
  heartsFinalScores: 'Endstand',

  heartsWins: 'Siege',
  heartsLosses: 'Niederlagen',
  heartsDraws: 'Unentschieden',

  heartsStep1Title: 'Drei Karten weitergeben',
  heartsStep1Body:
    'Vor fast jeder Runde suchst du drei Karten heraus und gibst sie weiter — nach links, dann nach rechts, dann nach gegenüber, dann eine Runde, in der niemand weitergibt.',
  heartsStep2Title: 'Farbe bedienen',
  heartsStep2Body:
    'Wer ausspielt, gibt die Farbe vor, und du musst sie bedienen, solange du sie hast; die höchste Karte dieser Farbe nimmt den Stich.',
  heartsStep3Title: 'Die wenigsten Punkte gewinnen',
  heartsStep3Body:
    'Jedes Herz, das du einsammelst, kostet einen Punkt und die Pik-Dame dreizehn, also gewinnt bei über hundert Punkten, wer am wenigsten hat.',
};
