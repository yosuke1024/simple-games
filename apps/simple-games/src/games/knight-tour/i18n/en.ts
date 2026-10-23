/** AI-authored source; no human review claimed. See docs/KNIGHT_TOUR_RULES.md. */
export const en = {
  knightTourName: 'Knight’s Tour',
  knightTourVisited: 'Visited: {count} / {total}',
  knightTourBoard: 'Board',
  knightTourCurrent: 'Knight, current square',
  knightTourVisitNumber: 'Visit {count}',
  knightTourLegal: 'Legal destination',
  knightTourEmpty: 'Unvisited',
  knightTourCell: 'Row {row}, column {col}: {content}',
  knightTourPaused: 'Paused. Resume when ready.',
  knightTourStuck: 'No moves left. Undo to try another route.',
  knightTourInstruction: 'Move in an L to a dotted square.',
  knightTourNewBoard: 'New board',
  knightTourWon: 'Tour complete!',
  knightTourWins: 'Completed',
  knightTourStep1Title: 'Move in an L',
  knightTourStep1Body:
    'The knight moves two squares in one direction and one sideways; dots show legal destinations.',
  knightTourStep2Title: 'Visit each square once',
  knightTourStep2Body: 'Every landing adds a number; a visited square cannot be used again.',
  knightTourStep3Title: 'Explore at your pace',
  knightTourStep3Body:
    'Visit all squares to finish. If you get stuck, Undo lets you try another route.',
} as const;
export type KnightTourMessages = Record<keyof typeof en, string>;
