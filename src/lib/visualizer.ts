import { COLORS, withAlpha } from './colors';
import { isDebugEnabled, onDebugChange } from './debugState';
import { appendToBody } from './dom';
import { hud } from './hud';

export interface VisualizerHandle {
  addTarget(target: Element): void;
  removeTarget(target: Element): void;
  disconnect(): void;
  reportEntries(entries: IntersectionObserverEntry[]): void;
}

interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface Box {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface TargetUI {
  intersectionEl: HTMLElement;
  badgeEl: HTMLElement;
  thresholdEls: HTMLElement[];
  flashUntil: number;
  lastCallbackText: string;
  /** True when the geometric ratio diverged from the last real callback ratio
   * (ancestor overflow clipping the overlay doesn't trace). */
  approximate: boolean;
}

interface ObserverRecord {
  id: number;
  label: string;
  flag: boolean;
  root: Element | null;
  rootMargin: string;
  scrollMargin: string | null;
  thresholds: number[];
  targets: Set<Element>;
  ui: {
    group: HTMLElement;
    rootOutline: HTMLElement;
    adjustedOutline: HTMLElement;
    strips: [HTMLElement, HTMLElement, HTMLElement, HTMLElement];
    targetUIs: Map<Element, TargetUI>;
  } | null;
}

const records = new Set<ObserverRecord>();
let container: HTMLElement | null = null;
let rafId: number | null = null;
let nextId = 1;

/**
 * Parses a rootMargin string ("10px", "-20% 0px", up to 4 values) into pixel
 * margins, resolving percentages against the root box size like the spec does
 * (top/bottom against height, left/right against width).
 */
export function parseRootMargin(rootMargin: string, rootBox: Box): Margins {
  const parts = rootMargin.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) parts.push('0px');
  // CSS 1/2/3/4-value expansion to [top, right, bottom, left]
  const [a, b = a, c = a, d = b] = parts;
  const width = rootBox.right - rootBox.left;
  const height = rootBox.bottom - rootBox.top;
  const resolve = (value: string, basis: number): number => {
    const n = parseFloat(value);
    if (Number.isNaN(n)) return 0;
    return value.trim().endsWith('%') ? (n / 100) * basis : n;
  };
  return {
    top: resolve(a, height),
    right: resolve(b, width),
    bottom: resolve(c, height),
    left: resolve(d, width),
  };
}

function ensureContainer(): HTMLElement {
  if (!container) {
    container = document.createElement('div');
    container.setAttribute('data-io-visualizer', '');
    Object.assign(container.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '2147483000',
      overflow: 'visible',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    });
    appendToBody(container);
  }
  return container;
}

function makeBoxEl(styles: Partial<CSSStyleDeclaration>): HTMLElement {
  const el = document.createElement('div');
  Object.assign(el.style, { position: 'absolute', boxSizing: 'border-box' }, styles);
  return el;
}

function mountRecord(record: ObserverRecord): void {
  if (record.ui) return;
  const group = document.createElement('div');
  ensureContainer().appendChild(group);

  const rootOutline = makeBoxEl({ border: `2px solid ${COLORS.bark}` });
  const adjustedOutline = makeBoxEl({ border: `2px dashed ${COLORS.moss}` });
  const strips = [0, 1, 2, 3].map(() =>
    makeBoxEl({ background: withAlpha(COLORS.moss, 0.18) }),
  ) as [HTMLElement, HTMLElement, HTMLElement, HTMLElement];

  strips.forEach((s) => group.appendChild(s));
  group.appendChild(rootOutline);
  group.appendChild(adjustedOutline);

  record.ui = { group, rootOutline, adjustedOutline, strips, targetUIs: new Map() };
  record.targets.forEach((t) => mountTarget(record, t));
}

function mountTarget(record: ObserverRecord, target: Element): void {
  if (!record.ui || record.ui.targetUIs.has(target)) return;
  const intersectionEl = makeBoxEl({
    background: withAlpha(COLORS.terracotta, 0.55),
    border: `2px solid ${COLORS.terracotta}`,
    boxShadow: `inset 0 0 0 2px ${withAlpha('#FFFFFF', 0.35)}`,
  });
  const badgeEl = makeBoxEl({
    background: COLORS.sage,
    color: COLORS.bark,
    fontSize: '11px',
    lineHeight: '1.4',
    padding: '2px 6px',
    borderRadius: '3px',
    whiteSpace: 'nowrap',
    border: `1px solid ${COLORS.bark}`,
    transition: 'box-shadow 0.15s',
  });
  // Trip lines: one per threshold per boundary it can cross (top and bottom),
  // skipping 0 and 1, which coincide with the target's own edges.
  const innerThresholds = record.thresholds.filter((t) => t > 0 && t < 1);
  const thresholdEls = innerThresholds.flatMap(() => [
    makeThresholdLineEl(),
    makeThresholdLineEl(),
  ]);
  record.ui.group.appendChild(intersectionEl);
  thresholdEls.forEach((el) => record.ui!.group.appendChild(el));
  record.ui.group.appendChild(badgeEl);
  record.ui.targetUIs.set(target, {
    intersectionEl,
    badgeEl,
    thresholdEls,
    flashUntil: 0,
    lastCallbackText: '',
    approximate: false,
  });
}

function makeThresholdLineEl(): HTMLElement {
  const el = makeBoxEl({
    borderTop: `1px dashed ${COLORS.bark}`,
    color: COLORS.bark,
    fontSize: '9px',
    lineHeight: '11px',
    paddingLeft: '3px',
    overflow: 'hidden',
  });
  return el;
}

function unmountTarget(record: ObserverRecord, target: Element): void {
  const ui = record.ui?.targetUIs.get(target);
  if (!ui) return;
  ui.intersectionEl.remove();
  ui.badgeEl.remove();
  ui.thresholdEls.forEach((el) => el.remove());
  record.ui!.targetUIs.delete(target);
}

function unmountRecord(record: ObserverRecord): void {
  record.ui?.group.remove();
  record.ui = null;
}

function positionBox(el: HTMLElement, box: Box): void {
  el.style.left = `${box.left}px`;
  el.style.top = `${box.top}px`;
  el.style.width = `${Math.max(0, box.right - box.left)}px`;
  el.style.height = `${Math.max(0, box.bottom - box.top)}px`;
}

function hideBox(el: HTMLElement): void {
  el.style.width = '0px';
  el.style.height = '0px';
}

function viewportBox(): Box {
  return { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight };
}

function elementBox(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
}

function intersect(a: Box, b: Box): Box | null {
  const box = {
    top: Math.max(a.top, b.top),
    left: Math.max(a.left, b.left),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  };
  return box.right > box.left && box.bottom > box.top ? box : null;
}

function rootBoxes(record: ObserverRecord): { rootBox: Box; adjusted: Box } {
  const rootBox = record.root ? elementBox(record.root) : viewportBox();
  const m = parseRootMargin(record.rootMargin, rootBox);
  return {
    rootBox,
    adjusted: {
      top: rootBox.top - m.top,
      right: rootBox.right + m.right,
      bottom: rootBox.bottom + m.bottom,
      left: rootBox.left - m.left,
    },
  };
}

function renderRecord(record: ObserverRecord, now: number, badgeSlots: Map<string, number>): void {
  const ui = record.ui!;
  const { rootBox, adjusted } = rootBoxes(record);

  positionBox(ui.rootOutline, rootBox);
  positionBox(ui.adjustedOutline, adjusted);

  // Margin strips: the band between each root edge and its margin-adjusted
  // edge, whichever direction the margin pushed it.
  const xSpan = {
    left: Math.min(rootBox.left, adjusted.left),
    right: Math.max(rootBox.right, adjusted.right),
  };
  const sideBands: Box[] = [
    { ...xSpan, top: Math.min(rootBox.top, adjusted.top), bottom: Math.max(rootBox.top, adjusted.top) },
    { ...xSpan, top: Math.min(rootBox.bottom, adjusted.bottom), bottom: Math.max(rootBox.bottom, adjusted.bottom) },
    {
      left: Math.min(rootBox.left, adjusted.left),
      right: Math.max(rootBox.left, adjusted.left),
      top: Math.max(rootBox.top, adjusted.top),
      bottom: Math.min(rootBox.bottom, adjusted.bottom),
    },
    {
      left: Math.min(rootBox.right, adjusted.right),
      right: Math.max(rootBox.right, adjusted.right),
      top: Math.max(rootBox.top, adjusted.top),
      bottom: Math.min(rootBox.bottom, adjusted.bottom),
    },
  ];
  sideBands.forEach((band, i) => {
    if (band.right > band.left && band.bottom > band.top) positionBox(ui.strips[i], band);
    else hideBox(ui.strips[i]);
  });

  record.targets.forEach((target) => {
    const tui = ui.targetUIs.get(target);
    if (!tui) return;
    const tBox = elementBox(target);
    const inter = intersect(tBox, adjusted);
    if (inter) positionBox(tui.intersectionEl, inter);
    else hideBox(tui.intersectionEl);

    const ratio = geometricRatio(tBox, adjusted);
    renderThresholdLines(record, tui, tBox);

    const thresholdsText = record.thresholds.map((t) => t.toFixed(2)).join(', ');
    const ratioText = `${tui.approximate ? '≈' : ''}${ratio.toFixed(2)}`;
    tui.badgeEl.textContent =
      `${record.label} · ratio ${ratioText} · thr [${thresholdsText}]` +
      (record.scrollMargin ? ` · sm ${record.scrollMargin}` : '') +
      (tui.lastCallbackText ? ` · ${tui.lastCallbackText}` : '');
    // Stack badges from different observers on the same target instead of
    // rendering them on top of each other.
    const slotKey = `${Math.round(tBox.left)}:${Math.round(tBox.top)}`;
    const slot = badgeSlots.get(slotKey) ?? 0;
    badgeSlots.set(slotKey, slot + 1);
    const stackedTop = tBox.top - 22 - slot * 22;
    tui.badgeEl.style.left = `${tBox.left}px`;
    tui.badgeEl.style.top = `${stackedTop < 2 ? 2 + slot * 22 : stackedTop}px`;
    tui.badgeEl.style.boxShadow =
      now < tui.flashUntil ? `0 0 0 3px ${COLORS.terracotta}` : 'none';
  });
}

function geometricRatio(tBox: Box, adjusted: Box): number {
  const inter = intersect(tBox, adjusted);
  const tArea = (tBox.right - tBox.left) * (tBox.bottom - tBox.top);
  const iArea = inter ? (inter.right - inter.left) * (inter.bottom - inter.top) : 0;
  return tArea > 0 ? iArea / tArea : 0;
}

/**
 * Draws each threshold's trip position inside the target box: the line at
 * `t · height` from the top edge touches the bottom boundary exactly when the
 * ratio passes `t` (target entering from below), and its mirror from the
 * bottom edge does the same against the top boundary. Coinciding lines
 * (symmetric threshold lists) are collapsed.
 */
function renderThresholdLines(record: ObserverRecord, tui: TargetUI, tBox: Box): void {
  const height = tBox.bottom - tBox.top;
  const width = tBox.right - tBox.left;
  const inner = record.thresholds.filter((t) => t > 0 && t < 1);
  const lines = new Map<number, { y: number; labels: Set<number> }>();
  inner.forEach((t) => {
    for (const y of [tBox.top + t * height, tBox.bottom - t * height]) {
      const key = Math.round(y);
      const line = lines.get(key) ?? { y, labels: new Set<number>() };
      line.labels.add(t);
      lines.set(key, line);
    }
  });
  let used = 0;
  lines.forEach(({ y, labels }) => {
    const el = tui.thresholdEls[used++];
    if (!el) return;
    el.style.left = `${tBox.left}px`;
    el.style.top = `${y}px`;
    el.style.width = `${Math.max(0, width)}px`;
    el.style.height = '12px';
    el.textContent = [...labels].join(' / ');
  });
  for (let i = used; i < tui.thresholdEls.length; i++) hideBox(tui.thresholdEls[i]);
}

function frame(): void {
  rafId = null;
  const now = performance.now();
  let anyActive = false;
  const badgeSlots = new Map<string, number>();
  records.forEach((record) => {
    const active = isDebugEnabled(record.flag);
    if (active && !record.ui) mountRecord(record);
    if (!active && record.ui) unmountRecord(record);
    if (record.ui) {
      anyActive = true;
      renderRecord(record, now, badgeSlots);
    }
  });
  hud.setVisible(anyActive);
  if (anyActive) rafId = requestAnimationFrame(frame);
}

function scheduleLoop(): void {
  if (rafId === null) rafId = requestAnimationFrame(frame);
}

onDebugChange(scheduleLoop);

export function normalizeThresholds(threshold: IntersectionObserverInit['threshold']): number[] {
  if (threshold === undefined) return [0];
  return Array.isArray(threshold) ? [...threshold] : [threshold];
}

export function registerObserver(
  options: IntersectionObserverInit,
  flag: boolean,
  label: string,
): VisualizerHandle {
  const record: ObserverRecord = {
    id: nextId++,
    label,
    flag,
    root: options.root instanceof Element ? options.root : null,
    rootMargin: options.rootMargin ?? '0px',
    // Newer spec addition for nested scrollers; not in all TS lib versions.
    scrollMargin: (options as { scrollMargin?: string }).scrollMargin ?? null,
    thresholds: normalizeThresholds(options.threshold),
    targets: new Set(),
    ui: null,
  };
  records.add(record);

  return {
    addTarget(target) {
      record.targets.add(target);
      if (record.ui) mountTarget(record, target);
      scheduleLoop();
    },
    removeTarget(target) {
      record.targets.delete(target);
      unmountTarget(record, target);
    },
    disconnect() {
      record.targets.clear();
      unmountRecord(record);
      records.delete(record);
      scheduleLoop();
    },
    reportEntries(entries) {
      if (!isDebugEnabled(record.flag)) return;
      const now = performance.now();
      const { adjusted } = rootBoxes(record);
      entries.forEach((entry) => {
        const tui = record.ui?.targetUIs.get(entry.target);
        if (tui) {
          tui.flashUntil = now + 400;
          tui.lastCallbackText = entry.isIntersecting ? 'IN' : 'OUT';
          // The overlay's ratio ignores ancestor overflow clipping; when it
          // disagrees with the real entry, mark the badge ratio as ≈.
          const geometric = geometricRatio(elementBox(entry.target), adjusted);
          tui.approximate = Math.abs(geometric - entry.intersectionRatio) > 0.05;
        }
        hud.log(record.label, entry, record.thresholds);
      });
    },
  };
}
