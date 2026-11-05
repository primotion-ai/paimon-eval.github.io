// Successes always show the nearest frame; other outcomes require a match within ±10 points.
(() => {
  const root = document.querySelector('#alignment-demo');
  if (!root) return;
  const get = name => root.querySelector(`#alignment-${name}`);
  const browser = get('browser'), chart = get('chart');
  const cache = new Map();
  const tolerance = .1, epsilon = 1e-10;
  let data, target = 0, initialized = false, request = 0, plot, guide;
  let timer, playing = false, visible = false, autoplayStarted = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const milestones = [0, 25, 50, 100];
  const percent = value => `${new Intl.NumberFormat('en', {maximumFractionDigits: 1}).format(value * 100)}%`;

  function nearestFrame(trajectory, progress) {
    // Strict comparison keeps the earlier frame when distances are exactly equal.
    const nearest = trajectory.frames.reduce((best, frame) =>
      Math.abs(frame.progress - progress) < Math.abs(best.progress - progress) ? frame : best);
    return trajectory.outcome === 'success' || Math.abs(nearest.progress - progress) <= tolerance + epsilon ? nearest : null;
  }

  function loadImage(frame) {
    const url = new URL(frame.image_path, document.baseURI).href;
    if (!cache.has(url)) {
      const pending = new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => image.decode().then(() => resolve(image), reject);
        image.onerror = () => reject(new Error('Image unavailable'));
        image.src = url;
      });
      cache.set(url, pending);
      pending.catch(() => { if (cache.get(url) === pending) cache.delete(url); });
    }
    return cache.get(url);
  }

  function makeCards() {
    get('frames').replaceChildren(); get('legend').replaceChildren();
    data.trajectories.forEach((trajectory, index) => {
      const card = document.createElement('div'); card.className = 'alignment-frame-card';
      card.style.setProperty('--trajectory-color', trajectory.color);
      const heading = document.createElement('div'); heading.className = 'alignment-frame-heading';
      const name = document.createElement('h4'); name.textContent = trajectory.name;
      const outcome = document.createElement('span'); outcome.className = 'alignment-outcome';
      outcome.textContent = {success: 'Success', suboptimal: 'Suboptimal', failure: 'Failure'}[trajectory.outcome];
      outcome.title = 'Original dataset outcome'; heading.append(name, outcome);
      const stage = document.createElement('div'); stage.className = 'alignment-image-stage'; stage.id = `alignment-stage-${index}`;
      stage.style.setProperty('--frame-ratio', `${trajectory.width} / ${trajectory.height}`);
      const image = document.createElement('img'); image.id = `alignment-image-${index}`; image.width = trajectory.width; image.height = trajectory.height; image.hidden = true; image.alt = '';
      const empty = document.createElement('span'); empty.className = 'visually-hidden'; empty.id = `alignment-empty-${index}`;
      empty.textContent = 'No frame within 10 percentage points of the target.'; empty.hidden = true;
      stage.append(image, empty); card.append(heading, stage); get('frames').append(card);
      const item = document.createElement('span'); const swatch = document.createElement('i'); swatch.style.background = trajectory.color; swatch.setAttribute('aria-hidden', 'true');
      item.append(swatch, trajectory.name); get('legend').append(item);
    });
  }

  async function showMatches() {
    const currentRequest = ++request, selectedTarget = target;
    const matches = data.trajectories.map(trajectory => nearestFrame(trajectory, selectedTarget / 100));
    get('frames').setAttribute('aria-busy', 'true');
    get('frame-error').hidden = true; get('frame-retry').hidden = true;
    matches.forEach((frame, index) => {
      const image = get(`image-${index}`);
      image.hidden = true; image.removeAttribute('src'); image.alt = ''; delete image.dataset.frameIndex;
      image.dataset.target = selectedTarget;
      get(`stage-${index}`).dataset.unmatched = String(frame === null);
      get(`empty-${index}`).hidden = frame !== null;
    });
    const results = await Promise.allSettled(matches.map(frame => frame ? loadImage(frame) : Promise.resolve(null)));
    if (currentRequest !== request) return;
    let failed = false;
    matches.forEach((frame, index) => {
      if (!frame) return;
      if (results[index].status === 'rejected') { failed = true; return; }
      const image = get(`image-${index}`);
      image.src = results[index].value.src;
      image.alt = `${data.task}, ${data.trajectories[index].name}, frame ${frame.frame_index + 1}, progress ${percent(frame.progress)}, nearest to target progress ${selectedTarget}%.`;
      image.dataset.frameIndex = frame.frame_index;
      image.hidden = false;
    });
    get('frames').setAttribute('aria-busy', 'false');
    get('frame-error').hidden = !failed; get('frame-retry').hidden = !failed;
    // Preload only valid matches at adjacent progress targets.
    for (const next of [selectedTarget - 5, selectedTarget + 5].filter(value => value >= 0 && value <= 100)) {
      data.trajectories.forEach(trajectory => {
        const frame = nearestFrame(trajectory, next / 100);
        if (frame) loadImage(frame).catch(() => {});
      });
    }
  }

  function svg(name, attributes, text) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function updateGuide() {
    if (!guide || !plot) return;
    guide.setAttribute('y1', plot.y(target / 100));
    guide.setAttribute('y2', plot.y(target / 100));
    get('chart-description').textContent = `Four full progress curves. The horizontal dashed line is at ${target}%. Successful trajectories show the nearest frame. Other trajectories require a frame within 10 percentage points of the target, otherwise they stay blank.`;
  }

  function drawChart() {
    if (!data || browser.hidden) return;
    const width = chart.clientWidth, height = chart.clientHeight;
    if (!width || !height) return;
    chart.setAttribute('viewBox', `0 0 ${width} ${height}`);
    chart.querySelectorAll(':scope > :not(title):not(desc)').forEach(node => node.remove());
    const left = 45, right = width - 10, top = 12, bottom = height - 12;
    const last = Math.max(...data.trajectories.map(t => t.frames[t.frames.length - 1].frame_index));
    plot = {x: index => left + (right - left) * index / Math.max(1, last), y: value => bottom - (bottom - top) * value};
    [0,.25,.5,.75,1].forEach(value => {
      chart.append(svg('line', {x1: left, x2: right, y1: plot.y(value), y2: plot.y(value), class: 'alignment-gridline'}));
      chart.append(svg('text', {x: left - 7, y: plot.y(value) + 5, 'text-anchor': 'end', class: 'alignment-axis-label'}, `${value * 100}%`));
    });
    data.trajectories.forEach((trajectory, index) => {
      chart.append(svg('polyline', {
        points: trajectory.frames.map(frame => `${plot.x(frame.frame_index)},${plot.y(frame.progress)}`).join(' '),
        stroke: trajectory.color, class: 'alignment-curve', 'data-trajectory': index,
      }));
    });
    guide = svg('line', {x1: left, x2: right, class: 'alignment-guide'});
    chart.append(guide);
    updateGuide();
  }

  function setTarget(value) {
    target = Math.max(0, Math.min(100, Math.round(value / 5) * 5));
    get('target').value = `${target}%`;
    get('up').disabled = target === 100;
    get('down').disabled = target === 0;
    const milestone = milestones.filter(value => value <= target).at(-1);
    get('event').querySelector('strong').textContent = `Progress ${milestone}%:`;
    updateGuide();
    return showMatches();
  }

  function updatePlayback() {
    get('play').textContent = playing ? 'Pause' : target === 100 ? 'Replay' : 'Play';
    get('play').setAttribute('aria-label', playing ? 'Pause progress animation' : target === 100 ? 'Replay progress animation' : 'Play progress animation');
  }
  function stopPlayback() {
    playing = false;
    clearTimeout(timer);
    updatePlayback();
  }
  function schedulePlayback() {
    clearTimeout(timer);
    if (!playing || !visible || document.hidden) return;
    timer = setTimeout(async () => {
      await setTarget(target + 5);
      if (target === 100) stopPlayback();
      else schedulePlayback();
    }, 1200);
  }
  function maybeAutoplay() {
    if (!data || browser.hidden || !visible || autoplayStarted || reducedMotion.matches) return;
    autoplayStarted = true;
    playing = true;
    updatePlayback();
    schedulePlayback();
  }
  get('play').addEventListener('click', async () => {
    autoplayStarted = true;
    if (playing) { stopPlayback(); return; }
    playing = true;
    updatePlayback();
    if (target === 100) await setTarget(0);
    schedulePlayback();
  });
  for (const [control, delta] of [['up', 5], ['down', -5]]) {
    get(control).addEventListener('click', () => {
      autoplayStarted = true;
      stopPlayback();
      setTarget(target + delta);
      updatePlayback();
    });
  }
  document.addEventListener('visibilitychange', schedulePlayback);
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) stopPlayback(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      maybeAutoplay();
      schedulePlayback();
    }, {threshold: .25}).observe(root);
  } else visible = true;
  get('frame-retry').addEventListener('click', showMatches);
  if ('ResizeObserver' in window) new ResizeObserver(drawChart).observe(chart);
  else window.addEventListener('resize', drawChart);

  async function initialize() {
    if (initialized) return;
    initialized = true;
    get('loading').hidden = false;
    get('loading').textContent = 'Loading progress alignment…';
    get('retry').hidden = true;
    try {
      const response = await fetch(new URL('assets/capabilities/semantic-alignment/index.json?v=20261105-bottle', document.baseURI));
      if (!response.ok) throw new Error('Progress data unavailable');
      data = await response.json();
      if (data.trajectories?.length !== 4 || data.trajectories.some(t => !['success', 'suboptimal', 'failure'].includes(t.outcome) || !Number.isFinite(t.width) || !Number.isFinite(t.height) || t.width <= 0 || t.height <= 0 || !t.frames?.length || t.frames.some(f => !Number.isFinite(f.progress) || f.progress < 0 || f.progress > 1))) throw new Error('Invalid progress data');
      get('task').textContent = data.task;
      makeCards();
      browser.hidden = false;
      get('loading').hidden = true;
      drawChart();
      await setTarget(0);
      maybeAutoplay();
    } catch {
      initialized = false;
      browser.hidden = true;
      get('loading').textContent = 'Progress alignment could not be loaded.';
      get('retry').hidden = false;
    }
  }
  get('retry').addEventListener('click', initialize);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); initialize(); }
    }, {rootMargin: '400px'});
    observer.observe(root);
  } else initialize();
})();
