import { createObserver, setObserverDebug } from '../lib';

const toggleIntersecting: IntersectionObserverCallback = (entries) => {
  entries.forEach((entry) => {
    entry.target.classList.toggle('is-intersecting', entry.isIntersecting);
  });
};

const cardA = document.getElementById('card-a')!;
const cardB = document.getElementById('card-b')!;
const cardC = document.getElementById('card-c')!;

// Card A — rebuilt live from the control bar inputs.
let observerA: IntersectionObserver | null = null;

function applyCardA(): void {
  observerA?.disconnect();
  const rootMargin = (document.getElementById('root-margin') as HTMLInputElement).value;
  const thresholdInput = (document.getElementById('threshold') as HTMLInputElement).value;
  const threshold = thresholdInput
    .split(',')
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !Number.isNaN(n));

  observerA = createObserver(
    toggleIntersecting,
    { rootMargin, threshold },
    { debug: true, label: 'A' },
  );
  observerA.observe(cardA);
  document.getElementById('card-a-config')!.textContent = rootMargin;
}

document.getElementById('apply')!.addEventListener('click', applyCardA);
applyCardA();

// Card B — no debug flag: behaves like a plain IntersectionObserver.
const observerB = createObserver(toggleIntersecting, { threshold: 0.2 });
observerB.observe(cardB);

// Card C — custom root: the nested scroller, not the viewport.
const observerC = createObserver(
  toggleIntersecting,
  { root: document.getElementById('scroller'), threshold: 0.5 },
  { debug: true, label: 'C' },
);
observerC.observe(cardC);

// Global kill-switch wired to the checkbox: false kills everything,
// null defers back to each observer's own flag.
const debugToggle = document.getElementById('debug-toggle') as HTMLInputElement;
debugToggle.addEventListener('change', () => {
  setObserverDebug(debugToggle.checked ? null : false);
});
