# Research media

Place research figures, keyframe images, and trajectory videos here. Use relative paths such as `assets/overview.webp` so the website works under both `username.github.io` and `username.github.io/repository/`.

Current media placeholders are in `index.html`:

- `.reference-frames`: four successful-reference keyframes.
- `.teaser`: overview figure or trajectory demonstration.
- `#user-defined-scales .capability-media`: comparison under different user-defined progress scales.
- `#one-shot-generalization .capability-media`: unseen-task and object demonstrations, with one reference per task.
- `#semantic-alignment .capability-media`: aligned semantic milestones across trajectories.
- `#cross-embodiment .embodiment-example`: human-to-robot or other cross-effector demonstrations.
- `.benchmark-figure`: benchmark comparison figure.
- `.application-card`: add downstream example figures here when available.

Replace placeholder contents with images that have descriptive `alt` text. Do not present the current schematic values as experimental predictions.

`progress-symbol.svg` is generated from the LaTeX source `\hat{p}` using MathJax 3.2.2 with its TeX math fonts and SVG path output. Its letter, accent, and spacing are engine-generated; do not replace them with webpage fonts or manually position the hat.

`annotation-examples/` contains the real PNG sequences and the public `index.json` used by `dataset-explorer.js`. Progress values are exported unchanged. The whole-trajectory event bubble is a placeholder awaiting curated descriptions; source dataset events are not published. Regenerate these assets with `python3 scripts/prepare-examples.py` when the local `bench_example/` source is available.

`yuheng-icon.svg` preserves the balance-scale paths from the naming note in an orange-red gradient (`#ff3b16` → `#ff7624` → `#ffac45`). The transparent 1024×1024 PNG is `../icon.png`; `yuheng-favicon-32.png` is the 32×32 PNG fallback for the SVG favicon. All site marks share this artwork.
