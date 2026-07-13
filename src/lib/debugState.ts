/**
 * Global kill-switch for all observer overlays.
 *
 * Resolution order for whether an observer's overlay renders:
 *   1. global override (setObserverDebug / window.__IO_DEBUG__ / ?io-debug URL param)
 *   2. the per-call debug flag passed to createObserver
 */

type Listener = () => void;

let globalOverride: boolean | null = null;
const listeners = new Set<Listener>();

let hooksInstalled = false;

/**
 * Wires up `window.__IO_DEBUG__` and the `?io-debug` URL param. Called on the
 * first `createObserver()` rather than at import time so merely importing the
 * module has no side effects (keeps it tree-shakeable).
 */
export function installGlobalHooks(): void {
  if (hooksInstalled || typeof window === 'undefined') return;
  hooksInstalled = true;
  if (new URLSearchParams(window.location.search).has('io-debug')) {
    setObserverDebug(true);
  }
  Object.defineProperty(window, '__IO_DEBUG__', {
    configurable: true,
    get: () => globalOverride,
    set: (value: boolean | null) => setObserverDebug(value),
  });
}

/**
 * true  -> force all overlays on
 * false -> force all overlays off
 * null  -> defer to each observer's own debug flag
 */
export function setObserverDebug(enabled: boolean | null): void {
  if (globalOverride === enabled) return;
  globalOverride = enabled;
  listeners.forEach((fn) => fn());
}

export function isDebugEnabled(perCallFlag: boolean): boolean {
  return globalOverride ?? perCallFlag;
}

export function onDebugChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
