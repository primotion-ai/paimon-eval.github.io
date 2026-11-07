// Six independent model charts share one decoded frame and playback clock.
(() => {
  const root = document.querySelector('#method-comparison');
  if (!root) return;
  const get = name => root.querySelector(`#compare-${name}`);
  const browser = get('browser');
  const taskSelect = get('task');
  const trajectorySelect = get('trajectory');
  const timeline = get('timeline');
  const image = get('image');
  const charts = get('charts');
  const assets = new URL('assets/benchmark-comparison/', document.baseURI);
  const outcomes = { success: 'Success', suboptimal: 'Suboptimal', failure: 'Failure' };
  const percent = value => `${new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value * 100)}%`;
  let data, task, trajectory, currentFrame = 0, requestedFrame = 0;
  let playing = false, timer, selection = 0, frameRequest = 0, initialized = false;
  let wantsPlayback = false, inView = false;
  const chartStates = [];
  const imageCache = new Map();

  function suspend() {
    playing = false;
    clearTimeout(timer);
    frameRequest += 1;
    get('image-stage').setAttribute('aria-busy', 'false');
    get('play-label').textContent = currentFrame === trajectory?.frames.length - 1 ? 'Replay' : 'Play';
    get('play-symbol').setAttribute('d', 'm8 5 11 7-11 7Z');
  }

  function pause() {
    wantsPlayback = false;
    suspend();
  }

  function startPlayback() {
    if (!wantsPlayback || playing || !inView || document.hidden || image.hidden) return;
    if (currentFrame >= trajectory.frames.length - 1) return pause();
    playing = true;
    get('play-label').textContent = 'Pause';
    get('play-symbol').setAttribute('d', 'M7 5h3v14H7ZM14 5h3v14h-3Z');
    timer = setTimeout(tick, 250 / Number(get('speed').value));
  }

  function loadImage(frame) {
    const url = new URL(frame.image_path, assets).href;
    if (!imageCache.has(url)) {
      const pending = new Promise((resolve, reject) => {
        const next = new Image();
        next.onload = () => next.decode().then(() => resolve(next), reject);
        next.onerror = () => reject(new Error('Frame image unavailable'));
        next.src = url;
      });
      imageCache.set(url, pending);
      pending.catch(() => {
        if (imageCache.get(url) === pending) imageCache.delete(url);
      });
    }
    return imageCache.get(url);
  }

  function updateCursor() {
    chartStates.forEach(({model, plot, cursor, dot, pastClip, futureClip, prediction, description}) => {
      const x = plot.x(currentFrame);
      const values = trajectory.curves[model.id];
      cursor.setAttribute('x1', x);
      cursor.setAttribute('x2', x);
      dot.setAttribute('cx', x);
      dot.setAttribute('cy', plot.y(values[currentFrame]));
      pastClip.setAttribute('width', x - plot.left + 3);
      futureClip.setAttribute('x', x);
      futureClip.setAttribute('width', currentFrame === trajectory.frames.length - 1 ? 0 : plot.right - x + 3);
      // Never include future model predictions in the visible path.
      prediction.setAttribute('points', values.slice(0, currentFrame + 1).map((value, i) => `${plot.x(i)},${plot.y(value)}`).join(' '));
      description.textContent = `${model.name}: ${percent(values[currentFrame])}. Progress ground truth: ${percent(trajectory.frames[currentFrame].progress)}. Frame ${currentFrame + 1} of ${trajectory.frames.length}.`;
    });
    get('chart-description').textContent = `Six models for ${task.instruction}. Frame ${currentFrame + 1} of ${trajectory.frames.length}. Model predictions end at the current frame; dashed ground truth is clear in the past and faded in the future.`;
  }

  async function showFrame(index) {
    const request = ++frameRequest;
    const version = selection;
    requestedFrame = Math.max(0, Math.min(trajectory.frames.length - 1, index));
    const target = requestedFrame;
    get('image-stage').setAttribute('aria-busy', 'true');
    get('frame-error').hidden = true;
    get('frame-retry').hidden = true;
    try {
      const loaded = await loadImage(trajectory.frames[target]);
      if (request !== frameRequest || version !== selection) return false;
      currentFrame = target;
      image.src = loaded.src;
      image.alt = `${task.instruction} — frame ${target + 1} of ${trajectory.frames.length}`;
      image.hidden = false;
      get('image-message').hidden = true;
      get('image-stage').setAttribute('aria-busy', 'false');
      get('frame-counter').textContent = `Frame ${target + 1} / ${trajectory.frames.length}`;
      get('progress').value = percent(trajectory.frames[target].progress);
      timeline.value = target;
      timeline.style.setProperty('--frame-position', `${target / Math.max(1, trajectory.frames.length - 1) * 100}%`);
      timeline.setAttribute('aria-valuetext', `Frame ${target + 1} of ${trajectory.frames.length}, progress ${percent(trajectory.frames[target].progress)}`);
      timeline.disabled = false;
      get('play').disabled = false;
      get('previous').disabled = target === 0;
      get('next').disabled = target === trajectory.frames.length - 1;
      if (!playing) get('play-label').textContent = target === trajectory.frames.length - 1 ? 'Replay' : 'Play';
      updateCursor();
      // Keep a small buffer ahead; other trajectories are fetched only when selected.
      trajectory.frames.slice(target + 1, target + 6).forEach(frame => { loadImage(frame).catch(() => {}); });
      return true;
    } catch {
      if (request !== frameRequest || version !== selection) return false;
      pause();
      get('image-stage').setAttribute('aria-busy', 'false');
      get('image-message').hidden = true;
      get('frame-error').textContent = `Frame ${target + 1} could not be loaded. Please retry.`;
      get('frame-error').hidden = false;
      get('frame-retry').hidden = false;
      timeline.value = currentFrame;
      return false;
    }
  }

  function svgElement(name, attributes, text) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function drawCharts() {
    chartStates.length = 0;
    charts.replaceChildren();
    const left = 42, right = 308, top = 12, bottom = 132;
    const plot = { left, right,
      x: i => left + (right - left) * i / (trajectory.frames.length - 1),
      y: value => bottom - (bottom - top) * value,
    };
    data.models.forEach((model, modelIndex) => {
      const card = document.createElement('figure');
      card.className = 'comparison-chart-card';
      card.style.setProperty('--model-color', model.color);
      card.dataset.model = model.id;
      const titleId = `comparison-title-${modelIndex}`, descId = `comparison-desc-${modelIndex}`;
      const chart = svgElement('svg', { viewBox: '0 0 320 172', class: 'comparison-mini-chart', role: 'img', 'aria-labelledby': `${titleId} ${descId}` });
      const description = svgElement('desc', { id: descId });
      chart.append(svgElement('title', { id: titleId }, `${model.name} and progress ground truth`), description);
      [0, .5, 1].forEach(value => {
        chart.append(svgElement('line', { x1: left, y1: plot.y(value), x2: right, y2: plot.y(value), class: 'dataset-gridline' }));
        chart.append(svgElement('text', { x: left - 7, y: plot.y(value) + 4, 'text-anchor': 'end', class: 'dataset-axis-label' }, `${value * 100}%`));
      });
      const last = trajectory.frames.length - 1;
      [0, Math.round(last / 2), last].forEach(i => {
        chart.append(svgElement('text', { x: plot.x(i), y: bottom + 18, 'text-anchor': 'middle', class: 'dataset-axis-label' }, i + 1));
      });
      chart.append(svgElement('text', { x: (left + right) / 2, y: 168, 'text-anchor': 'middle', class: 'dataset-axis-label' }, 'Frame'));
      chart.append(svgElement('rect', { x: left, y: top, width: right - left, height: bottom - top, class: 'comparison-plot-border' }));
      const defs = svgElement('defs', {}), clips = {};
      for (const part of ['past', 'future']) {
        const id = `comparison-${modelIndex}-${part}`;
        const clip = svgElement('clipPath', { id, clipPathUnits: 'userSpaceOnUse' });
        clips[part] = svgElement('rect', { x: left - 3, y: top - 3, width: 0, height: bottom - top + 6 });
        clip.append(clips[part]); defs.append(clip);
      }
      chart.append(defs);
      const truthPoints = trajectory.curves['ground-truth'].map((value, i) => `${plot.x(i)},${plot.y(value)}`).join(' ');
      for (const part of ['future', 'past']) {
        chart.append(svgElement('polyline', { points: truthPoints, class: `comparison-curve comparison-truth comparison-${part}`, 'clip-path': `url(#comparison-${modelIndex}-${part})` }));
      }
      const prediction = svgElement('polyline', { stroke: model.color, class: 'comparison-curve comparison-model' });
      const cursor = svgElement('line', { y1: top, y2: bottom, class: 'dataset-chart-cursor' });
      const dot = svgElement('circle', { r: 3.6, fill: model.color, stroke: '#fff', 'stroke-width': 1.4, class: 'comparison-current-dot' });
      chart.append(cursor, prediction, dot);
      const legend = document.createElement('figcaption');
      legend.className = 'comparison-model-legend';
      const swatch = document.createElement('i'); swatch.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span'); label.textContent = model.name;
      legend.append(swatch, label); card.append(chart, legend); charts.append(card);
      chartStates.push({ model, plot, cursor, dot, pastClip: clips.past, futureClip: clips.future, prediction, description });
    });
    updateCursor();
  }

  async function chooseTrajectory() {
    pause();
    wantsPlayback = true;
    selection += 1;
    currentFrame = 0;
    requestedFrame = 0;
    imageCache.clear();
    trajectory = task.trajectories[Number(trajectorySelect.value)];
    const version = selection;
    get('image-stage').style.setProperty('--frame-aspect', `${trajectory.width} / ${trajectory.height}`);
    image.width = trajectory.width; image.height = trajectory.height;
    timeline.max = trajectory.frames.length - 1;
    timeline.value = 0;
    timeline.style.setProperty('--frame-position', '0%');
    [timeline, get('play'), get('previous'), get('next')].forEach(control => { control.disabled = true; });
    image.hidden = true;
    image.removeAttribute('src');
    get('image-message').textContent = 'Loading frame…';
    get('image-message').hidden = false;
    get('frame-counter').textContent = `Frame 1 / ${trajectory.frames.length}`;
    get('progress').value = percent(trajectory.frames[0].progress);
    get('outcome').textContent = `Trajectory ${String(Number(trajectorySelect.value) + 1).padStart(2, '0')} · ${outcomes[trajectory.outcome]}`;
    get('outcome').dataset.outcome = trajectory.outcome;
    get('reference').hidden = !trajectory.is_reference;
    drawCharts();
    if (await showFrame(0) && version === selection) startPlayback();
  }

  function chooseTask() {
    task = data.tasks[Number(taskSelect.value)];
    trajectorySelect.replaceChildren(...task.trajectories.map((item, index) => new Option(
      `${String(index + 1).padStart(2, '0')} · ${outcomes[item.outcome]}${item.is_reference ? ' · reference' : ''}`, index,
    )));
    chooseTrajectory();
  }

  async function tick() {
    if (!playing) return;
    const version = selection;
    if (currentFrame >= trajectory.frames.length - 1) return pause();
    const shown = await showFrame(currentFrame + 1);
    if (!playing || version !== selection || !shown) return;
    if (currentFrame === trajectory.frames.length - 1) return pause();
    timer = setTimeout(tick, 250 / Number(get('speed').value));
  }

  get('play').addEventListener('click', async () => {
    if (playing) return pause();
    wantsPlayback = true;
    const version = selection;
    if (currentFrame === trajectory.frames.length - 1 && !await showFrame(0)) return;
    if (version === selection) startPlayback();
  });
  timeline.addEventListener('input', () => { pause(); showFrame(Number(timeline.value)); });
  get('previous').addEventListener('click', () => { pause(); showFrame(currentFrame - 1); });
  get('next').addEventListener('click', () => { pause(); showFrame(currentFrame + 1); });
  get('frame-retry').addEventListener('click', async () => { pause(); wantsPlayback = true; if (await showFrame(requestedFrame)) startPlayback(); });
  taskSelect.addEventListener('change', chooseTask);
  trajectorySelect.addEventListener('change', chooseTrajectory);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && playing) suspend(); else startPlayback();
  });

  async function initialize() {
    if (initialized) return;
    initialized = true;
    get('retry').hidden = true;
    get('loading').textContent = 'Loading method comparisons…';
    try {
      const response = await fetch(new URL('assets/benchmark-comparison/index.json?v=20261107-six-charts', document.baseURI));
      if (!response.ok) throw new Error('Dataset unavailable');
      data = await response.json();
      if (data.models?.length !== 6) throw new Error('Expected six methods');
      if (!data.tasks?.length || data.tasks.some(item => !item.trajectories?.length || item.trajectories.some(t => !t.frames?.length))) throw new Error('Empty dataset');
      taskSelect.replaceChildren(...data.tasks.map((item, index) => new Option(item.instruction, index)));
      browser.hidden = false;
      get('loading').hidden = true;
      chooseTask();
    } catch {
      initialized = false;
      get('loading').hidden = false;
      get('loading').textContent = 'Method comparisons could not be loaded. Please try again.';
      get('retry').hidden = false;
    }
  }
  get('retry').addEventListener('click', initialize);
  if ('IntersectionObserver' in window) {
    const loader = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { loader.disconnect(); initialize(); }
    }, { rootMargin: '500px' });
    loader.observe(root);
    new IntersectionObserver(entries => {
      inView = entries.some(entry => entry.isIntersecting);
      if (inView) startPlayback(); else if (playing) suspend();
    }).observe(root);
  } else { inView = true; initialize(); }
})();
