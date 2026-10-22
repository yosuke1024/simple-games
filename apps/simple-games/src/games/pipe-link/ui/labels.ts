/**
 * The spoken names of a tile (docs/PIPE_LINK_RULES.md §10, §11). One whole
 * phrase per type and orientation — fourteen of them — rather than direction
 * words joined at run time, so every locale words "a bend, up and right" its
 * own way (§11: no string concatenation). The keys are written out, not
 * assembled from a template, so a search for any of them finds its use.
 */
import type { MessageKey } from '@/i18n';
import type { TileType } from '../game';

const PIPES_KEYS: Readonly<Record<TileType, readonly MessageKey[]>> = {
  end: ['pipeLinkPipes_end_0', 'pipeLinkPipes_end_1', 'pipeLinkPipes_end_2', 'pipeLinkPipes_end_3'],
  straight: ['pipeLinkPipes_straight_0', 'pipeLinkPipes_straight_1'],
  elbow: [
    'pipeLinkPipes_elbow_0',
    'pipeLinkPipes_elbow_1',
    'pipeLinkPipes_elbow_2',
    'pipeLinkPipes_elbow_3',
  ],
  tee: ['pipeLinkPipes_tee_0', 'pipeLinkPipes_tee_1', 'pipeLinkPipes_tee_2', 'pipeLinkPipes_tee_3'],
};

/** The phrase for a tile's type in one orientation: "bend, up and right". */
export function pipesKey(type: TileType, orientation: number): MessageKey {
  return PIPES_KEYS[type][orientation] ?? PIPES_KEYS[type][0]!;
}

export const DIFFICULTY_KEYS = {
  easy: 'pipeLinkDifficulty_easy',
  medium: 'pipeLinkDifficulty_medium',
  hard: 'pipeLinkDifficulty_hard',
} as const satisfies Readonly<Record<string, MessageKey>>;
