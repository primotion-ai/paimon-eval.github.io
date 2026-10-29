// The dataset viewer uses exported progress labels, independent of the method illustration.
(() => {
  const root = document.querySelector('#annotation-examples');
  if (!root) return;
  const get = name => root.querySelector(`#dataset-${name}`);
  const browser = get('browser');
  const taskSelect = get('task');
  const trajectorySelect = get('trajectory');
  const timeline = get('timeline');
  const image = get('image');
  const chart = get('chart');
  const dialog = get('event-dialog');
  const assets = new URL('assets/annotation-examples/', document.baseURI);
  const outcomes = { success: 'Success', suboptimal: 'Suboptimal', failure: 'Failure' };
  const percent = value => `${new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value * 100)}%`;
  let data, task, trajectory, currentFrame = 0, requestedFrame = 0;
  let playing = false, timer, selection = 0, frameRequest = 0, initialized = false;
  let cursor, dot, plot;
  const imageCache = new Map();

  function pause() {
    if (playing) {
      frameRequest += 1;
      get('image-stage').setAttribute('aria-busy', 'false');
    }
    playing = false;
    clearTimeout(timer);
    get('play-label').textContent = currentFrame === trajectory?.frames.length - 1 ? 'Replay' : 'Play';
    get('play-symbol').setAttribute('d', 'm8 5 11 7-11 7Z');
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
    if (!plot || !cursor || !dot) return;
    const x = plot.x(currentFrame);
    const y = plot.y(trajectory.frames[currentFrame].progress);
    cursor.setAttribute('x1', x);
    cursor.setAttribute('x2', x);
    dot.setAttribute('cx', x);
    dot.setAttribute('cy', y);
    get('chart-description').textContent = `Frame ${currentFrame + 1} of ${trajectory.frames.length}, annotated progress ${percent(trajectory.frames[currentFrame].progress)}. The dashed line marks the displayed frame.`;
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

  function drawChart() {
    if (!trajectory || browser.hidden) return;
    const width = chart.clientWidth;
    const height = chart.clientHeight;
    if (!width || !height) return;
    chart.setAttribute('viewBox', `0 0 ${width} ${height}`);
    chart.querySelectorAll(':scope > :not(title):not(desc)').forEach(node => node.remove());
    const left = 52, right = width - 16, top = 20, bottom = height - 52;
    plot = {
      x: index => left + (right - left) * index / Math.max(1, trajectory.frames.length - 1),
      y: progress => bottom - (bottom - top) * progress,
    };
    [0, 0.25, 0.5, 0.75, 1].forEach(value => {
      chart.append(svgElement('line', { x1: left, y1: plot.y(value), x2: right, y2: plot.y(value), class: 'dataset-gridline' }));
      chart.append(svgElement('text', { x: left - 10, y: plot.y(value) + 5, 'text-anchor': 'end', class: 'dataset-axis-label' }, `${value * 100}%`));
    });
    const last = trajectory.frames.length - 1;
    [...new Set([0, Math.round(last / 4), Math.round(last / 2), Math.round(last * 3 / 4), last])].forEach(index => {
      chart.append(svgElement('text', { x: plot.x(index), y: bottom + 25, 'text-anchor': 'middle', class: 'dataset-axis-label' }, index + 1));
    });
    chart.append(svgElement('text', { x: (left + right) / 2, y: height - 4, 'text-anchor': 'middle', class: 'dataset-axis-label' }, 'Frame'));
    const points = trajectory.frames.map((frame, index) => `${plot.x(index)},${plot.y(frame.progress)}`);
    chart.append(svgElement('path', { d: `M${left},${bottom} L${points.join(' L')} L${right},${bottom} Z`, class: 'dataset-chart-area' }));
    chart.append(svgElement('polyline', { points: points.join(' '), class: 'dataset-chart-line' }));
    cursor = svgElement('line', { y1: top, y2: bottom, class: 'dataset-chart-cursor' });
    dot = svgElement('circle', { r: 5.5, class: 'dataset-chart-dot' });
    chart.append(cursor, dot);
    updateCursor();
  }

  function chooseTrajectory() {
    pause();
    selection += 1;
    currentFrame = 0;
    requestedFrame = 0;
    imageCache.clear();
    trajectory = task.trajectories[Number(trajectorySelect.value)];
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
    get('outcome').textContent = outcomes[trajectory.outcome];
    get('outcome').dataset.outcome = trajectory.outcome;
    get('reference').hidden = !trajectory.is_reference;
    get('event-title').textContent = task.instruction;
    get('event-scope').textContent = `Trajectory ${Number(trajectorySelect.value) + 1} · ${outcomes[trajectory.outcome]} · Frames 1–${trajectory.frames.length}`;
    // One event covers the full trajectory for now. Dataset event annotations are not imported.
    get('event-description').textContent = 'Event description coming soon.';
    drawChart();
    showFrame(0);
  }

  function chooseTask() {
    task = data.tasks[Number(taskSelect.value)];
    trajectorySelect.replaceChildren(...task.trajectories.map((item, index) => new Option(
      `${String(index + 1).padStart(2, '0')} · ${outcomes[item.outcome]}${item.is_reference ? ' · ICL reference' : ''}`, index,
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
    playing = true;
    get('play-label').textContent = 'Pause';
    get('play-symbol').setAttribute('d', 'M7 5h3v14H7ZM14 5h3v14h-3Z');
    if (currentFrame === trajectory.frames.length - 1 && !await showFrame(0)) return;
    if (playing) timer = setTimeout(tick, 250 / Number(get('speed').value));
  });
  timeline.addEventListener('input', () => { pause(); showFrame(Number(timeline.value)); });
  get('previous').addEventListener('click', () => { pause(); showFrame(currentFrame - 1); });
  get('next').addEventListener('click', () => { pause(); showFrame(currentFrame + 1); });
  get('frame-retry').addEventListener('click', () => { pause(); showFrame(requestedFrame); });
  taskSelect.addEventListener('change', chooseTask);
  trajectorySelect.addEventListener('change', chooseTrajectory);
  get('chart-button').addEventListener('click', () => { pause(); dialog.showModal(); });
  dialog.addEventListener('close', () => get('chart-button').focus({ preventScroll: true }));
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  if ('ResizeObserver' in window) new ResizeObserver(drawChart).observe(chart);
  else window.addEventListener('resize', drawChart);

  async function initialize() {
    if (initialized) return;
    initialized = true;
    get('retry').hidden = true;
    get('loading').textContent = 'Loading trajectory examples…';
    try {
      const response = await fetch(new URL('index.json', assets));
      if (!response.ok) throw new Error('Dataset unavailable');
      data = await response.json();
      if (!data.tasks?.length || data.tasks.some(item => !item.trajectories?.length || item.trajectories.some(t => !t.frames?.length))) throw new Error('Empty dataset');
      taskSelect.replaceChildren(...data.tasks.map((item, index) => new Option(item.instruction, index)));
      browser.hidden = false;
      get('loading').hidden = true;
      chooseTask();
    } catch {
      initialized = false;
      get('loading').hidden = false;
      get('loading').textContent = 'Trajectory examples could not be loaded. Please try again.';
      get('retry').hidden = false;
    }
  }
  get('retry').addEventListener('click', initialize);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); initialize(); }
    }, { rootMargin: '500px' });
    observer.observe(root);
  } else initialize();
})();
