// Each Manhattan-distance ring plays its own videos and unchanged model curves together.
(() => {
  const root = document.querySelector('#one-shot-demo');
  if (!root) return;
  const get = name => root.querySelector(`#one-shot-${name}`);
  const grid = get('grid'), scroll = root.querySelector('.one-shot-scroll');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const cache = new Map(), cards = [];
  const positions = Array.from({length: 25}, (_, i) => ({row: Math.floor(i / 5), col: i % 5}))
    .map(p => ({...p, ring: Math.abs(p.row - 2) + Math.abs(p.col - 2)}))
    .sort((a, b) => a.ring - b.ring || a.row - b.row || a.col - b.col);
  let data, initialized = false, visible = false, started = false, playing = false;
  let wave = 0, frame = 0, complete = false, timer, revision = 0, inFlight = false;
  const svg = (tag, attributes) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  };
  const x = i => 5 + i / 31 * 70, y = progress => 65 - progress * 60;

  function loadImage(frame) {
    const url = new URL(frame.image_path, document.baseURI).href;
    if (!cache.has(url)) {
      const promise = new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => image.decode().then(() => resolve(image), reject);
        image.onerror = () => reject(new Error('Image unavailable'));
        image.src = url;
      });
      cache.set(url, promise);
      promise.catch(() => { if (cache.get(url) === promise) cache.delete(url); });
    }
    return cache.get(url);
  }
  function makeCards() {
    grid.replaceChildren(); cards.length = 0;
    data.trajectories.forEach((trajectory, index) => {
      const position = positions[index];
      const element = document.createElement('div'); element.className = 'one-shot-cell';
      element.style.gridRow = position.row + 1; element.style.gridColumn = position.col + 1;
      element.dataset.outcome = trajectory.outcome;
      element.style.setProperty('--curve-color', trajectory.outcome === 'success' ? '#318572' : '#cd555b');
      element.dataset.ring = position.ring; element.dataset.trajectory = index;
      const image = document.createElement('img'); image.width = trajectory.width; image.height = trajectory.height;
      image.alt = `${trajectory.task}, trajectory frame 1`; image.draggable = false;
      const chart = svg('svg', {viewBox: '0 0 80 70', role: 'img', 'aria-label': `Predicted progress: ${trajectory.task}; ${trajectory.outcome}`});
      chart.append(svg('rect', {x: 5, y: 5, width: 70, height: 60, class: 'one-shot-plot-border'}));
      [.5].forEach(p => chart.append(svg('line', {x1: 5, x2: 75, y1: y(p), y2: y(p), class: 'one-shot-gridline'})));
      const line = svg('polyline', {class: 'one-shot-curve', fill: 'none'});
      const dot = svg('circle', {r: 2.2, class: 'one-shot-dot'});
      chart.append(line, dot); element.append(image, chart); grid.append(element);
      cards.push({element, image, line, dot, trajectory, ...position});
    });
  }
  function paint(card, index) {
    const f = card.trajectory.frames[index];
    card.image.src = f.image_path;
    card.image.alt = `${card.trajectory.task}, trajectory frame ${index + 1}`;
    card.element.dataset.frame = index;
    card.line.setAttribute('points', card.trajectory.frames.slice(0, index + 1)
      .map((f, i) => `${x(i)},${y(f.progress)}`).join(' '));
    card.dot.setAttribute('cx', x(index)); card.dot.setAttribute('cy', y(f.progress));
  }
  function updateStates() {
    root.dataset.wave = wave; root.dataset.complete = String(complete);
    cards.forEach(card => {
      card.element.dataset.state = complete || card.ring < wave ? 'complete' : card.ring === wave ? 'active' : 'waiting';
    });
    get('play').textContent = playing ? 'Pause' : complete ? 'Replay' : 'Play';
    get('play').setAttribute('aria-label', playing ? 'Pause multi-task animation' : complete ? 'Replay multi-task animation' : 'Play multi-task animation');
  }
  function halt() {
    playing = false; clearTimeout(timer); revision++; inFlight = false; updateStates();
  }
  function prefetch() {
    // Only prefetch nearby frames; avoid decoding all 800 images before playback.
    const next = frame === 31 ? wave + 1 : wave;
    const start = frame === 31 ? 0 : frame + 1;
    cards.filter(c => c.ring === next).forEach(c => {
      for (let i = start; i < Math.min(32, start + 3); i++) loadImage(c.trajectory.frames[i]).catch(() => {});
    });
  }
  function schedule() {
    clearTimeout(timer);
    if (!playing || !visible || document.hidden || inFlight || complete) return;
    timer = setTimeout(tick, frame === 31 ? 500 : 170);
  }
  async function tick() {
    if (!playing || !visible || document.hidden || inFlight) return;
    const token = revision;
    const nextWave = frame === 31 ? wave + 1 : wave;
    const nextFrame = frame === 31 ? 0 : frame + 1;
    if (nextWave === 5) { complete = true; halt(); return; }
    inFlight = true;
    try {
      const current = cards.filter(c => c.ring === nextWave);
      await Promise.all(current.map(c => loadImage(c.trajectory.frames[nextFrame])));
      if (token !== revision) return;
      inFlight = false;
      // Keep a hidden/offscreen animation at its last displayed frame until it resumes.
      if (!visible || document.hidden || !playing) return;
      wave = nextWave; frame = nextFrame;
      current.forEach(c => paint(c, frame));
      updateStates(); prefetch(); schedule();
    } catch {
      if (token !== revision) return;
      halt(); get('status').textContent = 'Some frames could not load.'; get('retry').hidden = false;
    }
  }
  function start() {
    started = true; playing = true; get('retry').hidden = true;
    get('status').textContent = 'Progress across unseen tasks';
    updateStates(); prefetch(); schedule();
  }
  function restart() {
    halt(); wave = 0; frame = 0; complete = false;
    cards.forEach(c => paint(c, 0)); start();
  }
  function maybeAutoplay() {
    if (data && !scroll.hidden && visible && !started && !reducedMotion.matches) start();
  }
  get('play').addEventListener('click', () => {
    if (playing) halt(); else if (complete) restart(); else start();
  });
  get('restart').addEventListener('click', restart);
  get('retry').addEventListener('click', () => { if (data && !scroll.hidden) start(); else initialize(); });
  document.addEventListener('visibilitychange', schedule);
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) halt(); });

  async function initialize() {
    if (initialized) return;
    initialized = true; get('status').textContent = 'Loading trajectories…'; get('retry').hidden = true;
    try {
      const response = await fetch(new URL('assets/capabilities/one-shot-multi-task/index.json?v=20261105-radial', document.baseURI));
      if (!response.ok) throw new Error('Progress data unavailable');
      const incoming = await response.json();
      if (incoming.trajectories?.length !== 25 || incoming.trajectories.some(t => !['success', 'failure'].includes(t.outcome) || t.width !== 160 || t.height !== 120 || t.frames?.length !== 32 || t.frames.some((f, i) => f.frame_index !== i || !Number.isFinite(f.progress) || f.progress < 0 || f.progress > 1))) throw new Error('Invalid progress data');
      await Promise.all(incoming.trajectories.map(t => loadImage(t.frames[0])));
      data = incoming; makeCards(); cards.forEach(c => paint(c, 0));
      scroll.hidden = false; get('play').disabled = false; get('restart').disabled = false;
      get('status').textContent = 'Progress across unseen tasks'; updateStates(); maybeAutoplay();
    } catch {
      initialized = false; get('status').textContent = 'Trajectories could not be loaded.'; get('retry').hidden = false;
    }
  }
  if ('IntersectionObserver' in window) {
    const loader = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { loader.disconnect(); initialize(); }
    }, {rootMargin: '400px'}); loader.observe(root);
    new IntersectionObserver(entries => {
      visible = entries.some(e => e.isIntersecting);
      maybeAutoplay(); schedule();
    }, {threshold: .15}).observe(root);
  } else { visible = true; initialize(); }
})();
