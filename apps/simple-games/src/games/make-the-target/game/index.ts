/**
 * What ui/, state/ and storage/ may use (docs/MAKE_THE_TARGET_RULES.md §5).
 * Left out on purpose: the solver (no Hint, no "can this still be made?"),
 * the generator and the bundled table (searched or picked only for a new
 * problem), and newSession.ts — the state layer imports that one by name, the
 * single door to the generator. searchBoundary.test.ts holds these lines.
 */
export * from './daily';
export * from './engine';
export * from './restore';
export * from './serialize';
export * from './session';
export * from './tiers';
export * from './types';
