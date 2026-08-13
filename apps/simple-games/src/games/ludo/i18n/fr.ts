import type { LudoMessages } from './en';

export const fr: LudoMessages = {
  ludoName: 'Ludo',
  ludoChooseOpponent: 'Choisis ton adversaire',
  ludoDifficulty_easy: 'Facile',
  ludoDifficulty_normal: 'Normal',
  ludoDifficulty_hard: 'Difficile',
  ludoRecordNote: '{wins} victoires · {losses} défaites',
  ludoConfirmSwitchTitle: 'Remplacer la partie en cours ?',
  ludoConfirmSwitchBody: 'Ta partie {current} sera remplacée par une nouvelle partie {next}.',

  // ---- the board ----
  ludoBoardLabel: 'Plateau de Ludo',
  ludoYou: 'Toi',
  ludoCpu: 'CPU {n}',
  ludoSeatHome: '{home} sur 4 à la maison',
  ludoSafeSquare: 'Case sûre',
  // Where a pawn is, in words. Composed into the two labels below so a seat, a
  // square and a state are each translated once.
  ludoWhereYard: 'à l’écurie',
  ludoWhereSquare: 'sur la case {n}',
  ludoWhereSafe: 'sur la case sûre {n}',
  ludoWhereColumn: 'sur la case {n} du couloir d’arrivée',
  ludoWhereHome: 'à la maison',
  ludoPawnAt: '{seat}, {where}',
  ludoMovePawn: 'Déplacer ton pion {where}',

  // ---- the die and the turn ----
  ludoRollAction: 'Lancer',
  ludoRollLabel: 'Lancer le dé',
  ludoDieLabel: 'Le dé affiche {die}',
  ludoDieUnrolled: 'Le dé n’a pas encore été lancé',
  ludoTurnRoll: 'À toi — lance le dé.',
  ludoTurnMove: 'Tu as fait {die}. Touche un pion pour le déplacer.',
  ludoTurnCpu: 'Le CPU {n} joue…',
  ludoAutoPass: 'Rien ne peut bouger avec ce chiffre — le tour passe.',
  ludoThirdSix: 'Trois six d’affilée — le tour passe.',
  ludoRollAgain: 'Un six — relance.',

  // ---- the end of a match ----
  ludoWinTitle: 'Tu as gagné !',
  ludoWinBody: 'Tes quatre pions sont à la maison.',
  ludoLoseTitle: 'Le CPU {n} gagne',
  ludoLoseBody: 'Ses quatre pions sont à la maison. La prochaine partie est gratuite.',
  ludoNoContestTitle: 'Sans résultat',
  ludoNoContestBody:
    'La partie a atteint sa limite de lancers sans que personne soit arrivé à la maison. Elle compte comme jouée, mais ni comme victoire ni comme défaite.',
  ludoWins: 'Victoires',
  ludoLosses: 'Défaites',

  // ---- Quick Rules (docs/LUDO_RULES.md §11) ----
  ludoStep1Title: 'Un six libère un pion',
  ludoStep1Body:
    'Lance le dé, puis touche un pion pour le déplacer. Seuls les pions que les règles autorisent peuvent être touchés — les autres restent en place.',
  ludoStep2Title: 'Un six relance le dé',
  ludoStep2Body:
    'Fais un six et tu relances aussitôt. Mais après trois six d’affilée, le tour passe sans qu’aucun pion ne bouge.',
  ludoStep3Title: 'Atterrir sur un adversaire le renvoie',
  ludoStep3Body:
    'Chaque pion adverse sur cette case retourne aussitôt à l’écurie. Les cases sûres en sont protégées. Une prise ne donne pas de lancer supplémentaire — seul un six le fait.',
  ludoStep4Title: 'Empiler tes pions ne protège rien',
  ludoStep4Body:
    'Deux de tes pions sur une même case ne bloquent personne et ne protègent rien. Si un adversaire atterrit dessus, toute la pile retourne d’un coup à l’écurie — un tas de pions est une cible, pas un fort.',
  ludoStep5Title: 'On rentre à la maison au nombre exact',
  ludoStep5Body:
    'Un lancer qui dépasserait la maison ne fait pas bouger ce pion. Fais rentrer tes quatre pions pour gagner. Chaque chiffre vient de la graine de la partie, les six faces ont la même chance, et aucune place n’est lancée différemment.',
};
