import type { DominoesMessages } from './en';

export const de: DominoesMessages = {
  dominoesName: 'Dominoes',
  dominoesRecordNote: '{wins} Siege · {losses} Niederlagen',

  dominoesTileLabel: 'Stein {a}–{b}',
  dominoesLineLabel: 'Spielreihe: {count} Steine, linkes Ende {left}, rechtes Ende {right}',
  dominoesHandLabel: 'Deine Steine',
  dominoesPlayLeft: 'Am linken Ende anlegen ({value})',
  dominoesPlayRight: 'Am rechten Ende anlegen ({value})',
  dominoesCpuShort: 'CPU',
  dominoesBoneyardShort: 'Talon',
  dominoesCpuTiles: 'Die CPU hält {count} Steine',
  dominoesBoneyardTiles: 'Talon: {count} Steine',
  dominoesDraw: 'Ziehen',
  dominoesPass: 'Passen',

  dominoesYourTurn: 'Du bist dran',
  dominoesCpuTurn: 'Die CPU denkt nach…',
  dominoesCpuDrew: 'Die CPU hat einen Stein gezogen',
  dominoesCpuPassed: 'Die CPU hat gepasst. Du bist dran',
  dominoesMustDraw: 'Kein Stein passt. Zieh vom Talon',
  dominoesNoTileFits: 'Kein Stein passt, und der Talon ist leer. Passen',
  dominoesChooseEnd: 'Wähle ein Ende für diesen Stein',
  dominoesOpenedYou: 'Du hast mit {tile} eröffnet',
  dominoesOpenedCpu: 'Die CPU hat mit {tile} eröffnet. Du bist dran',

  dominoesWinTitle: 'Du hast gewonnen!',
  dominoesWinBodyOut: 'Du hast deinen letzten Stein gelegt.',
  dominoesWinBodyBlocked: 'Niemand konnte mehr legen, und deine Augensumme war niedriger.',
  dominoesLoseTitle: 'Die CPU gewinnt',
  dominoesLoseBodyOut: 'Die CPU hat ihren letzten Stein gelegt.',
  dominoesLoseBodyBlocked: 'Niemand konnte mehr legen, und die Augensumme der CPU war niedriger.',
  dominoesDrawTitle: 'Unentschieden',
  dominoesDrawBody: 'Niemand konnte mehr legen, und die Augensummen waren gleich.',
  dominoesScoreYou: 'Du bekommst {points} Punkte',
  dominoesScoreCpu: 'Die CPU bekommt {points} Punkte',
  dominoesPipsLeft: 'Verbleibende Augen: du {you}, CPU {cpu}',

  dominoesWins: 'Siege',
  dominoesLosses: 'Niederlagen',
  dominoesDraws: 'Unentschieden',

  dominoesStep1Title: 'Ein Ende anlegen',
  dominoesStep1Body: 'Leg einen Stein, dessen Zahl zu einem der offenen Enden der Reihe passt.',
  dominoesStep2Title: 'Nichts passt? Ziehen',
  dominoesStep2Body:
    'Passt kein Stein, zieh vom Talon, bis einer passt. Nur bei leerem Talon passen.',
  dominoesStep3Title: 'Als Erster fertig werden',
  dominoesStep3Body:
    'Leg deinen letzten Stein, um zu gewinnen. Die beim Gegner verbliebenen Augen sind dein Punktestand.',
};
