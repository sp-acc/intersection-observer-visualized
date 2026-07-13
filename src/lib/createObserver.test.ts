import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// jsdom has no IntersectionObserver — a minimal stub records delegated calls.
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit;
  observed: Element[] = [];
  unobserved: Element[] = [];
  disconnected = false;

  constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
    this.callback = callback;
    this.options = options;
    FakeIntersectionObserver.instances.push(this);
  }
  observe(target: Element) {
    this.observed.push(target);
  }
  unobserve(target: Element) {
    this.unobserved.push(target);
  }
  disconnect() {
    this.disconnected = true;
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

beforeEach(() => {
  vi.resetModules();
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('createObserver', () => {
  it('delegates observe/unobserve/disconnect to the native observer', async () => {
    const { createObserver } = await import('./createObserver');
    const observer = createObserver(() => {});
    const native = FakeIntersectionObserver.instances[0];
    const el = document.createElement('div');

    observer.observe(el);
    expect(native.observed).toEqual([el]);

    observer.unobserve(el);
    expect(native.unobserved).toEqual([el]);

    observer.disconnect();
    expect(native.disconnected).toBe(true);
  });

  it('invokes the user callback with entries and the observer', async () => {
    const { createObserver } = await import('./createObserver');
    const userCallback = vi.fn();
    const observer = createObserver(userCallback);
    const native = FakeIntersectionObserver.instances[0];

    const entries = [{ target: document.createElement('div'), isIntersecting: true, intersectionRatio: 1 }] as unknown as IntersectionObserverEntry[];
    native.callback(entries, observer);
    expect(userCallback).toHaveBeenCalledWith(entries, observer);
  });

  it('passes options through to the native observer', async () => {
    const { createObserver } = await import('./createObserver');
    const options = { rootMargin: '-20% 0px', threshold: [0, 0.5, 1] };
    createObserver(() => {}, options);
    expect(FakeIntersectionObserver.instances[0].options).toBe(options);
  });

  it('adds nothing to the DOM when debug is off', async () => {
    const { createObserver } = await import('./createObserver');
    const observer = createObserver(() => {});
    observer.observe(document.createElement('div'));
    expect(document.querySelector('[data-io-visualizer]')).toBeNull();
    expect(document.querySelector('[data-io-hud]')).toBeNull();
  });
});

describe('noop variant', () => {
  it('returns a bare native observer', async () => {
    const { createObserver } = await import('./noop');
    const observer = createObserver(() => {}, {}, { debug: true, label: 'x' });
    expect(observer).toBe(FakeIntersectionObserver.instances[0] as unknown as IntersectionObserver);
    observer.observe(document.createElement('div'));
    expect(document.querySelector('[data-io-visualizer]')).toBeNull();
  });
});
