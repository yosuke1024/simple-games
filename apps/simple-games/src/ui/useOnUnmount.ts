/**
 * Runs `fn` once, when the component unmounts — the `fn` of the latest render,
 * however often its identity changed before then.
 *
 * It exists for one job (docs/GAME_LIFECYCLE.md「アンマウントで計上する」): a
 * game's provider hands it the sync it already runs on its own exits and on a
 * background, so leaving by a door the game never hears — the browser's Back,
 * a home-screen shortcut to another game — still books the play seconds since
 * the last sync. The sync is idempotent (it books only what is not booked
 * yet), so running it after an exit that already did is harmless.
 *
 * Why not `useEffect(() => () => sync(), [sync])`: that cleanup also runs
 * whenever `sync` changes identity, while the provider is still on screen. A
 * sync that writes state and takes that state as a dependency would then
 * write, re-render, and run again — a loop no one asked for. Keeping the
 * latest `fn` in a ref makes the cleanup belong to the unmount alone.
 */
import { useEffect, useRef } from 'react';

export function useOnUnmount(fn: () => void): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => () => fnRef.current(), []);
}
