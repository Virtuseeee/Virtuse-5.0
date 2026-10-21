# Virtuse 3D mark — web

`virtuse-logo-3d.html` is a self-contained page: Three.js 0.160 from the same jsDelivr import map the homepage cube already uses, the V mark extruded with bevelled edges, the cube's light rig (ACES, key/fill/rim/front) plus a procedural studio environment with strip lights for the metallic bands.

Query parameters
- `play=1` plays with requestAnimationFrame (intro 2.6 s, then idle). Without it the page renders the settled frame only (used by the renderer and by `prefers-reduced-motion`).
- `variant=intro|outro|loop`, `theme=dark|light|transparent`, `size=0.46…1` (scale of the mark).
- Tuning knobs used for the final look: `rough=0.16 env=0.75 topi=4 tiltx=0.04 sweep=45 expo=1.2 key=3.2 front=0.6`.

Embedding on virtuse.com (suggestion, not deployed): an `<iframe src="virtuse-logo-3d.html?play=1&theme=transparent&size=0.9" loading="lazy">` in a loader or hero slot, or paste the module script into the page next to the cube script (they share the import map). Reduced motion: the module checks `prefers-reduced-motion` and shows the still frame. Cost: the three.js module is already cached for homepage visitors; the page itself is 8 kB.
