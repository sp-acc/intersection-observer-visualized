import { beforeEach, describe, expect, it, vi } from 'vitest';

// debugState holds module-level state, so each test gets a fresh copy.
async function freshModule() {
  vi.resetModules();
  return import('./debugState');
}

beforeEach(() => {
  delete (window as any).__IO_DEBUG__;
  window.history.replaceState(null, '', '/');
});

describe('debug resolution order', () => {
  it('defers to the per-call flag when no override is set', async () => {
    const { isDebugEnabled } = await freshModule();
    expect(isDebugEnabled(true)).toBe(true);
    expect(isDebugEnabled(false)).toBe(false);
  });

  it('a true override forces every observer on', async () => {
    const { isDebugEnabled, setObserverDebug } = await freshModule();
    setObserverDebug(true);
    expect(isDebugEnabled(false)).toBe(true);
  });

  it('a false override forces every observer off', async () => {
    const { isDebugEnabled, setObserverDebug } = await freshModule();
    setObserverDebug(false);
    expect(isDebugEnabled(true)).toBe(false);
  });

  it('null restores per-call behavior', async () => {
    const { isDebugEnabled, setObserverDebug } = await freshModule();
    setObserverDebug(true);
    setObserverDebug(null);
    expect(isDebugEnabled(false)).toBe(false);
  });
});

describe('change listeners', () => {
  it('notifies on change and supports unsubscribe', async () => {
    const { onDebugChange, setObserverDebug } = await freshModule();
    const listener = vi.fn();
    const unsubscribe = onDebugChange(listener);

    setObserverDebug(true);
    expect(listener).toHaveBeenCalledTimes(1);

    setObserverDebug(true); // no-op: value unchanged
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setObserverDebug(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('global hooks (installed on demand, not at import)', () => {
  it('importing the module leaves window untouched', async () => {
    await freshModule();
    expect(Object.getOwnPropertyDescriptor(window, '__IO_DEBUG__')).toBeUndefined();
  });

  it('installGlobalHooks wires window.__IO_DEBUG__ to the override', async () => {
    const { installGlobalHooks, isDebugEnabled } = await freshModule();
    installGlobalHooks();
    (window as any).__IO_DEBUG__ = true;
    expect(isDebugEnabled(false)).toBe(true);
    expect((window as any).__IO_DEBUG__).toBe(true);
  });

  it('installGlobalHooks picks up the ?io-debug URL param', async () => {
    window.history.replaceState(null, '', '/?io-debug');
    const { installGlobalHooks, isDebugEnabled } = await freshModule();
    installGlobalHooks();
    expect(isDebugEnabled(false)).toBe(true);
  });
});
