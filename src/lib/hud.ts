import { COLORS, withAlpha } from './colors';
import { appendToBody } from './dom';

const MAX_ENTRIES = 20;

class Hud {
  private panel: HTMLElement | null = null;
  private list: HTMLElement | null = null;
  private collapsed = false;
  private lastKey = '';
  private lastCount = 0;

  private ensure(): void {
    if (this.panel) return;
    this.panel = document.createElement('div');
    this.panel.setAttribute('data-io-hud', '');
    Object.assign(this.panel.style, {
      position: 'fixed',
      right: '12px',
      bottom: '12px',
      width: '340px',
      maxHeight: '40vh',
      background: withAlpha(COLORS.sand, 0.95),
      color: COLORS.bark,
      border: `2px solid ${COLORS.bark}`,
      borderRadius: '6px',
      zIndex: '2147483001',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '11px',
      display: 'none',
      flexDirection: 'column',
      overflow: 'hidden',
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      padding: '5px 8px',
      fontWeight: '700',
      background: COLORS.sage,
      borderBottom: `1px solid ${COLORS.bark}`,
      userSelect: 'none',
    });

    const title = document.createElement('span');
    title.textContent = '▾ IntersectionObserver log';
    title.style.cursor = 'pointer';
    title.style.flex = '1';
    title.addEventListener('click', () => {
      this.collapsed = !this.collapsed;
      title.textContent = `${this.collapsed ? '▸' : '▾'} IntersectionObserver log`;
      if (this.list) this.list.style.display = this.collapsed ? 'none' : 'block';
    });

    const clearButton = document.createElement('button');
    clearButton.textContent = 'clear';
    Object.assign(clearButton.style, {
      pointerEvents: 'auto',
      font: 'inherit',
      fontWeight: '600',
      padding: '0 6px',
      cursor: 'pointer',
      background: COLORS.sand,
      color: COLORS.bark,
      border: `1px solid ${COLORS.bark}`,
      borderRadius: '3px',
    });
    clearButton.addEventListener('click', () => {
      if (this.list) this.list.innerHTML = '';
      this.lastKey = '';
      this.lastCount = 0;
    });

    header.appendChild(title);
    header.appendChild(clearButton);

    this.list = document.createElement('div');
    Object.assign(this.list.style, { overflowY: 'auto', padding: '4px 8px' });

    this.panel.appendChild(header);
    this.panel.appendChild(this.list);
    appendToBody(this.panel);
  }

  setVisible(visible: boolean): void {
    if (!visible && !this.panel) return;
    this.ensure();
    this.panel!.style.display = visible ? 'flex' : 'none';
  }

  log(label: string, entry: IntersectionObserverEntry, thresholds: number[]): void {
    this.ensure();
    const time = new Date().toLocaleTimeString(undefined, { hour12: false });
    const ratio = entry.intersectionRatio;
    const nearest = thresholds.reduce((a, b) =>
      Math.abs(b - ratio) < Math.abs(a - ratio) ? b : a,
    );
    const targetLabel =
      entry.target.id ||
      (entry.target as HTMLElement).dataset?.ioLabel ||
      entry.target.tagName.toLowerCase();

    const text =
      `[${label}] ${targetLabel} ` +
      `${entry.isIntersecting ? 'IN ' : 'OUT'} ratio=${ratio.toFixed(3)} thr≈${nearest}`;

    // Coalesce bursts of identical entries (e.g. ratio jitter around a
    // threshold while a transition animates) into one row with a counter.
    if (text === this.lastKey && this.list!.firstElementChild) {
      this.lastCount++;
      this.list!.firstElementChild.textContent = `${time} ${text} ×${this.lastCount}`;
      return;
    }
    this.lastKey = text;
    this.lastCount = 1;

    const row = document.createElement('div');
    row.style.padding = '2px 0';
    row.style.borderBottom = `1px dotted ${withAlpha(COLORS.bark, 0.25)}`;
    row.style.color = entry.isIntersecting ? COLORS.moss : COLORS.terracotta;
    row.textContent = `${time} ${text}`;

    this.list!.prepend(row);
    while (this.list!.children.length > MAX_ENTRIES) {
      this.list!.lastElementChild!.remove();
    }
  }
}

export const hud = new Hud();
