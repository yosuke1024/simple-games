// English source.
export const en = {
  hanoiTowersName: 'Hanoi Towers',
  hanoiTowersChoose: 'Choose the number of disks',
  hanoiTowersBest: 'Fewest moves',
  hanoiTowersBoard: 'Towers',
  hanoiTowersClear: 'Tower complete!',
  hanoiTowersClearBody: 'All disks are on the right peg.',
  hanoiTowersRule1: 'Tap a peg to lift its top disk, then tap another peg to place it.',
  hanoiTowersRule2: 'A larger disk cannot sit on a smaller disk.',
  hanoiTowersRule3:
    'Move every disk to the right peg; Undo is unlimited and there is no time limit.',
  hanoiTowersDisks: 'Disks: {count}',
  hanoiTowersMinimum: 'Minimum: {count} moves',
  hanoiTowersSelect: 'Choose a peg to lift its top disk.',
  hanoiTowersPlace: 'Choose a destination for the disk from peg {peg}.',
  hanoiTowersInvalid: 'Choose an empty peg or a peg with a larger top disk.',
  hanoiTowersPeg: 'Peg {peg}, top disk {disk}',
  hanoiTowersEmpty: 'Peg {peg}, empty',
} as const;
export type HanoiTowersMessages = Record<keyof typeof en, string>;
