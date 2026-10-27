import type { NearbyPlugin } from './native';

/** Both room types share one native singleton; delayed cleanup must respect its current owner. */
export const radioOwners = new WeakMap<NearbyPlugin, { stop(): Promise<void> }>();
