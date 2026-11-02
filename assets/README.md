# Research media

Place research figures, keyframe images, and trajectory videos here. Use relative paths such as `assets/overview.webp` so the website works under both `username.github.io` and `username.github.io/repository/`.

Current media placeholders are in `index.html`:

- `.reference-frames`: four successful-reference keyframes.
- `.teaser`: overview figure or trajectory demonstration.
- `#one-shot-generalization .capability-media`: unseen-task and object demonstrations, with one reference per task.
- `.application-card`: add downstream example figures here when available.

Replace placeholder contents with images that have descriptive `alt` text. Do not present the current schematic values as experimental predictions.

`progress-symbol.svg` is generated from the LaTeX source `\hat{p}` using MathJax 3.2.2 with its TeX math fonts and SVG path output. Its letter, accent, and spacing are engine-generated; do not replace them with webpage fonts or manually position the hat.

`annotation-examples/` contains the real PNG sequences and the public `index.json` used by `dataset-explorer.js`. Progress values are exported unchanged. The whole-trajectory event bubble is a placeholder awaiting curated descriptions; source dataset events are not published. Regenerate these assets with `python3 scripts/prepare-examples.py` when the local `bench_example/` source is available.

`yuheng-icon.svg` preserves the balance-scale paths from the naming note in an orange-red gradient (`#ff3b16` → `#ff7624` → `#ffac45`). The transparent 1024×1024 PNG is `../icon.png`; `yuheng-favicon-32.png` is the 32×32 PNG fallback for the SVG favicon. All site marks share this artwork.

`benchmark/ood_20261031/` contains a reproducible Matplotlib SVG chart of Average scores and sanitized CSV/JSON results. Regenerate with `scripts/prepare-benchmark.py`; the input export remains local. Average is the equal-weight mean of the three overall agreement metrics, excluding MAE.

`benchmark-comparison/index.json` contains progress ground truth and eight selected model curves for six Close the drawer trajectories. Frame paths reuse `annotation-examples/`; no PNGs are duplicated. Regenerate with `python3 scripts/prepare-comparison.py`. Predictions are copied unchanged from the local comparison export, including Robometer's supplied interpolation.

`scale-explorer/` contains four unmodified 320×240 PNGs from the local `explore_the_idea_example/` folder: frames 0000, 0015, 0023 and 0030 map to Start, Grasp, Move and Finish(Place). `script.js` switches these images and plots the same four reference-scale values used by the progress output. Horizontal positions are equally spaced semantic stages, not the original frame indices.

`capabilities/different-progress-scale/` contains three reference images, full-precision predictions under two label scales, and responsive Matplotlib SVG figures. Regenerate with `scripts/prepare-scale-comparison.py`. Curve markers identify reference frame indices 0, 17 and 31 at their actual predicted progress values.

`capabilities/semantic-alignment/index.json` contains two shared-reference progress predictions and paths to checksum-identical existing annotation PNGs. Regenerate with `scripts/prepare-semantic-alignment.py`; nearest-frame matching uses unmodified predicted progress, not the annotation viewer’s labels.

`capabilities/cross-embodiment/` contains the four 32-frame image sequences and curated predictions used by `cross-embodiment.js`. Regenerate with `scripts/prepare-cross-embodiment.py`; it validates source checksums and CSV values. Shared playback follows sampled frame position, not synchronized real timestamps.

`capabilities/one-shot-multi-task/` contains six checksum-verified first/last frames, three independent SVG curves, and unchanged Yuheng 27B predictions for three tasks. Regenerate with `scripts/prepare-one-shot.py`. Source exports remain local; published metadata excludes machine paths.
