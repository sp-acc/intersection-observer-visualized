/**
 * Zero-cost stand-in for production builds.
 *
 * Alias `observer-visualized` to `observer-visualized/noop` in your bundler
 * (or import from this subpath behind an env check) and `createObserver`
 * degrades to a plain `new IntersectionObserver(...)` — no visualizer, no HUD,
 * no global hooks, nothing extra in the bundle.
 */
import type { ObserverDebugOptions } from './createObserver';

export type { ObserverDebugOptions };

export function createObserver(
  callback: IntersectionObserverCallback,
  options: IntersectionObserverInit = {},
  _debug: boolean | ObserverDebugOptions = false,
): IntersectionObserver {
  return new IntersectionObserver(callback, options);
}

export function setObserverDebug(_enabled: boolean | null): void {}

export { COLORS } from './colors';
