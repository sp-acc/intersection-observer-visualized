# observer-visualized

A color-coded visual debug layer for `IntersectionObserver`. Wrap your observer with one util and flip a flag to *see* `rootMargin`, `threshold`, the root bounds, and the live intersection rectangle while you scroll — instead of reasoning about them blind.

## Install

```bash
npm install observer-visualized
```

Or hack on the repo directly:

```bash
npm install
npm run dev   # opens the demo
```

## Usage

`createObserver` is a drop-in replacement for `new IntersectionObserver(...)`:

```ts
import { createObserver, setObserverDebug } from 'observer-visualized';

const observer = createObserver(
  (entries) => { /* your normal callback */ },
  { rootMargin: '-20% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
  { debug: true, label: 'hero' },   // or just `true`; omit for plain behavior
);
observer.observe(element);
```

With the flag off (or omitted) the returned observer behaves exactly like a native one — no overlay, no HUD entries.

## What you see (earthy palette)

| Color | Element |
| --- | --- |
| 🟫 Bark `#4A3B2A` solid outline | The root's bounds (viewport or the `root` element) |
| 🟢 Moss `#6B7F3F` translucent band + dashed line | The `rootMargin` zone and the *effective* intersection boundary it produces |
| 🟠 Terracotta `#C1663E` fill | The live intersection rectangle between target and margin-adjusted root |
| 🟫 Bark dashed lines across the target | Each threshold's trip position — the line touches the effective boundary exactly when that threshold fires |
| 🌿 Sage `#9CAF88` badge | Live intersection ratio, configured thresholds, `scrollMargin` (if set), and IN/OUT — flashes when the real callback fires |
| 🏜 Sand `#E8DCC3` panel | Bottom-right HUD logging actual callback entries (time, label, target, ratio, nearest threshold) |

The ratio on the badge is computed geometrically every frame, so you see it move continuously between threshold firings; the HUD and badge flashes reflect the *real* observer callbacks. When the geometric ratio disagrees with the real callback's ratio (ancestor `overflow` clipping the overlay doesn't trace), the badge marks it with `≈`.

## Enable / disable

- **Per observer**: the third argument — `true` / `{ debug: true, label }`.
- **Global override**: `setObserverDebug(true | false | null)` — `true` forces overlays on for *every* observer created through the wrapper (even ones without the flag), `false` kills all overlays, `null` defers back to each observer's own flag.
- **Console**: `window.__IO_DEBUG__ = false` (same semantics).
- **URL**: append `?io-debug` to force overlays on without touching code.

## Production builds

Importing the library has no side effects (`sideEffects: false`); the global hooks and DOM only appear once `createObserver` runs with debugging active. To strip the visualizer from production bundles entirely, alias the package to its no-op entry, which returns a bare native observer:

```ts
// vite.config.ts — swap the whole library out of prod bundles
resolve: {
  alias: isProd ? { 'observer-visualized': 'observer-visualized/noop' } : {},
}
```

Records for observers you drop without calling `disconnect()` are released when the observer is garbage-collected (via `FinalizationRegistry`), but calling `disconnect()` when you're done is still the tidy option.

## Notes & limits

- The overlay approximates clipping: the browser also clips intersection through every ancestor's `overflow`, which the visualizer doesn't trace (it intersects the target rect with the margin-adjusted root rect only). The `≈` badge marker tells you when this is happening.
- `scrollMargin` (newer spec addition for nested scrollers) passes through to the native observer and shows on the badge, but its geometry is not visualized yet.
- The library is framework-agnostic vanilla TS; a React hook can be layered on top of `createObserver`.

## Development

```bash
npm test            # vitest
npm run build       # library → dist/ (ESM + CJS + .d.ts)
npm run build:demo  # demo site → dist-demo/
```
