# Virtuse logo animation — web

Files
- virtuse-logo-mark.svg — static lockup (mark + outlined "Virtuse" wordmark, Inter 800 converted to paths, nav proportions). Wordmark uses `currentColor`, so set `color` on the parent for dark/light.
- virtuse-logo-mark-animated.svg / -on-light.svg — same lockup with the animation CSS embedded (text colour fixed for dark / light backgrounds). Plays once when loaded, also as `<img src>` (no script needed). Honors `prefers-reduced-motion` (static logo).
- virtuse-logo-anim.css — the keyframes alone, for inline-SVG use (add class `anim` to the `<svg>`; `--v-text` / `--v-muted` override text colours).
- demo.html — header, light, loader and `<img>` examples.

Timing (1.6 s total)
0–0.68 s  left stroke slides in from upper-left, right stroke from upper-right (80 ms later), expo-out ease
0.56–1.12 s  one soft gradient sheen crosses the mark (clipped to the V)
0.76–1.31 s  letters "Virtuse" rise in, 26 ms apart
(video only) 1.15–1.67 s  "WEALTH MANAGEMENT" fades in

Staging suggestion (not deployed): inline `virtuse-logo-mark-animated.svg` as a loader on news.html inside the existing `.loading` state, or replace the nav `.nav-logo` SVG+span with the lockup SVG (plays once per page load). Both are one-file swaps; no JS.
