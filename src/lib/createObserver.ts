import { installGlobalHooks } from './debugState';
import { registerObserver, type VisualizerHandle } from './visualizer';

export interface ObserverDebugOptions {
  debug?: boolean;
  /** Shown on the target badge and in the HUD log. */
  label?: string;
}

let observerCount = 0;

// Drops an observer's visualizer record when the observer itself is
// garbage-collected without an explicit disconnect(), so the wrapper never
// retains records (and their target elements) longer than the observer lives.
// The handle holds no reference back to the observer, so registration does not
// keep the observer alive.
const finalizer =
  typeof FinalizationRegistry !== 'undefined'
    ? new FinalizationRegistry<VisualizerHandle>((handle) => handle.disconnect())
    : null;

/**
 * Drop-in replacement for `new IntersectionObserver(callback, options)`.
 *
 * Pass `true` (or `{ debug: true, label: '...' }`) as the third argument to
 * activate the visual debug layer for this observer. The overlay can also be
 * forced on/off globally at runtime via `setObserverDebug()`,
 * `window.__IO_DEBUG__ = true/false`, or the `?io-debug` URL param — so every
 * observer created through this wrapper registers with the visualizer; only
 * the rendering is gated by the flags.
 */
export function createObserver(
  callback: IntersectionObserverCallback,
  options: IntersectionObserverInit = {},
  debug: boolean | ObserverDebugOptions = false,
): IntersectionObserver {
  installGlobalHooks();
  const debugOptions = typeof debug === 'boolean' ? { debug } : debug;
  const label = debugOptions.label ?? `observer-${++observerCount}`;

  const handle = registerObserver(options, debugOptions.debug ?? false, label);

  const observer = new IntersectionObserver((entries, obs) => {
    handle.reportEntries(entries);
    callback(entries, obs);
  }, options);

  const { observe, unobserve, disconnect, takeRecords } = observer;
  observer.observe = (target) => {
    handle.addTarget(target);
    observe.call(observer, target);
  };
  observer.unobserve = (target) => {
    handle.removeTarget(target);
    unobserve.call(observer, target);
  };
  observer.disconnect = () => {
    handle.disconnect();
    disconnect.call(observer);
  };
  observer.takeRecords = () => {
    const entries = takeRecords.call(observer);
    handle.reportEntries(entries);
    return entries;
  };

  finalizer?.register(observer, handle);

  return observer;
}
