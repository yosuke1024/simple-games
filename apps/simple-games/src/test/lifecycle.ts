/**
 * Test support for the resource-release contract (docs/GAME_LIFECYCLE.md):
 * after a game unmounts, none of its timers, animation frames, or
 * window/document listeners may survive.
 *
 * `trackResources()` wraps the registration functions with real, forwarding
 * spies — not fake timers, which would trip over React's own scheduling — and
 * `assertReleased()` reports whatever was registered during the tracked window
 * and never released. Each entry carries the stack captured at registration,
 * so a failure names the offending call site, not just "1 leaked timer".
 *
 * Callers are expected to warm up first (mount and unmount the game once
 * before tracking): module singletons legitimately register process-wide
 * handlers on first use — the sound service's visibilitychange, Capacitor's
 * web shims — and those belong to the shell's lifetime, not the game's.
 */

interface Entry {
  kind: string;
  detail: string;
  stack: string;
}

export interface ResourceTracker {
  /** Throws with a per-registration report if anything is still live. */
  assertReleased(): void;
  /** Puts the original functions back. Always call, in a finally block. */
  restore(): void;
}

/** The registration stack, trimmed to the first frame outside this file. */
function callSite(): string {
  const lines = (new Error().stack ?? '').split('\n').slice(1);
  const outside = lines.find((line) => !line.includes('lifecycle.ts'));
  return (outside ?? lines[0] ?? '(no stack)').trim();
}

export function trackResources(): ResourceTracker {
  const leaks = new Map<string, Entry>();
  let nextKey = 0;
  const track = (kind: string, detail: string): string => {
    const key = `${kind}:${nextKey++}`;
    leaks.set(key, { kind, detail, stack: callSite() });
    return key;
  };

  const origSetTimeout = window.setTimeout.bind(window);
  const origClearTimeout = window.clearTimeout.bind(window);
  const origSetInterval = window.setInterval.bind(window);
  const origClearInterval = window.clearInterval.bind(window);
  const origRaf = window.requestAnimationFrame?.bind(window);
  const origCancelRaf = window.cancelAnimationFrame?.bind(window);
  const origWindowAdd = window.addEventListener.bind(window);
  const origWindowRemove = window.removeEventListener.bind(window);
  const origDocumentAdd = document.addEventListener.bind(document);
  const origDocumentRemove = document.removeEventListener.bind(document);

  const timeoutKeys = new Map<number, string>();
  window.setTimeout = ((handler: TimerHandler, ms?: number, ...args: unknown[]) => {
    const id = origSetTimeout(
      (...inner: unknown[]) => {
        // A timer that fired is not a leak; only a pending one is.
        leaks.delete(timeoutKeys.get(id) ?? '');
        timeoutKeys.delete(id);
        if (typeof handler === 'function') handler(...inner);
      },
      ms,
      ...args,
    );
    timeoutKeys.set(id, track('setTimeout', `${ms ?? 0}ms`));
    return id;
  }) as typeof window.setTimeout;
  window.clearTimeout = ((id?: number) => {
    if (id !== undefined) {
      leaks.delete(timeoutKeys.get(id) ?? '');
      timeoutKeys.delete(id);
    }
    origClearTimeout(id);
  }) as typeof window.clearTimeout;

  const intervalKeys = new Map<number, string>();
  window.setInterval = ((handler: TimerHandler, ms?: number, ...args: unknown[]) => {
    const id = origSetInterval(handler as never, ms, ...args);
    intervalKeys.set(id, track('setInterval', `${ms ?? 0}ms`));
    return id;
  }) as typeof window.setInterval;
  window.clearInterval = ((id?: number) => {
    if (id !== undefined) {
      leaks.delete(intervalKeys.get(id) ?? '');
      intervalKeys.delete(id);
    }
    origClearInterval(id);
  }) as typeof window.clearInterval;

  // jsdom only provides requestAnimationFrame when pretending to be visual.
  // When it is absent, install a fake that never fires: the leak question is
  // "was every requested frame cancelled?", which needs no actual frames.
  const rafKeys = new Map<number, string>();
  let fakeRafId = 1;
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    if (origRaf) {
      const id = origRaf((time) => {
        leaks.delete(rafKeys.get(id) ?? '');
        rafKeys.delete(id);
        cb(time);
      });
      rafKeys.set(id, track('requestAnimationFrame', ''));
      return id;
    }
    const id = fakeRafId++;
    rafKeys.set(id, track('requestAnimationFrame', '(no rAF in jsdom: never fires)'));
    return id;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((id: number) => {
    leaks.delete(rafKeys.get(id) ?? '');
    rafKeys.delete(id);
    if (origCancelRaf) origCancelRaf(id);
  }) as typeof window.cancelAnimationFrame;

  // window/document listeners: match removal by target + type + listener +
  // capture flag, the same identity addEventListener itself uses.
  const listenerEntries: {
    key: string;
    target: 'window' | 'document';
    type: string;
    listener: unknown;
    capture: boolean;
  }[] = [];
  const captureOf = (options?: boolean | AddEventListenerOptions) =>
    typeof options === 'boolean' ? options : (options?.capture ?? false);
  const wrapAdd =
    (target: 'window' | 'document', orig: typeof window.addEventListener) =>
    (type: string, listener: unknown, options?: boolean | AddEventListenerOptions) => {
      listenerEntries.push({
        key: track('addEventListener', `${target} "${type}"`),
        target,
        type,
        listener,
        capture: captureOf(options),
      });
      orig(type, listener as EventListener, options);
    };
  const wrapRemove =
    (target: 'window' | 'document', orig: typeof window.removeEventListener) =>
    (type: string, listener: unknown, options?: boolean | EventListenerOptions) => {
      const capture = captureOf(options);
      const index = listenerEntries.findIndex(
        (e) =>
          e.target === target &&
          e.type === type &&
          e.listener === listener &&
          e.capture === capture,
      );
      if (index !== -1) {
        leaks.delete(listenerEntries[index]!.key);
        listenerEntries.splice(index, 1);
      }
      orig(type, listener as EventListener, options);
    };
  window.addEventListener = wrapAdd('window', origWindowAdd) as typeof window.addEventListener;
  window.removeEventListener = wrapRemove(
    'window',
    origWindowRemove,
  ) as typeof window.removeEventListener;
  document.addEventListener = wrapAdd(
    'document',
    origDocumentAdd,
  ) as typeof document.addEventListener;
  document.removeEventListener = wrapRemove(
    'document',
    origDocumentRemove,
  ) as typeof document.removeEventListener;

  return {
    assertReleased() {
      if (leaks.size === 0) return;
      const report = [...leaks.values()]
        .map((e) => `  ${e.kind} ${e.detail}\n    registered at ${e.stack}`)
        .join('\n');
      throw new Error(
        `${leaks.size} resource(s) survived unmount (docs/GAME_LIFECYCLE.md):\n${report}`,
      );
    },
    restore() {
      window.setTimeout = origSetTimeout as typeof window.setTimeout;
      window.clearTimeout = origClearTimeout as typeof window.clearTimeout;
      window.setInterval = origSetInterval as typeof window.setInterval;
      window.clearInterval = origClearInterval as typeof window.clearInterval;
      window.requestAnimationFrame = origRaf as typeof window.requestAnimationFrame;
      window.cancelAnimationFrame = origCancelRaf as typeof window.cancelAnimationFrame;
      window.addEventListener = origWindowAdd;
      window.removeEventListener = origWindowRemove;
      document.addEventListener = origDocumentAdd;
      document.removeEventListener = origDocumentRemove;
    },
  };
}

/**
 * A 2D context stand-in that absorbs any drawing call: jsdom's canvas has no
 * context at all, and the arcade boards bail out before starting their loop
 * when getContext returns null — which would make a leak test of the loop
 * test nothing. Property reads return further absorbers, so gradient and
 * measure-text chains hold up too. Returns a restore function.
 */
export function stubCanvas2d(): () => void {
  const absorber = (): unknown =>
    new Proxy(function () {} as object, {
      get: (target, prop) => {
        if (prop === Symbol.toPrimitive) return () => 0;
        return Reflect.get(target, prop) ?? absorber();
      },
      set: () => true,
      apply: () => absorber(),
    });
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string) {
    if (kind === '2d') return absorber() as CanvasRenderingContext2D;
    return null;
  } as typeof HTMLCanvasElement.prototype.getContext;
  return () => {
    HTMLCanvasElement.prototype.getContext = original;
  };
}

/** jsdom has no matchMedia; the boards read it for the dark-scheme repaint. */
export function stubMatchMedia(): () => void {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}
