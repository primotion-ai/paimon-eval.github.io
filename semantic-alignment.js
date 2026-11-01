// Compare independently nearest frames at a shared progress target, without monotonicization.
(() => {
  const root = document.querySelector('#alignment-demo');
  if (!root) return;
  const get = name => root.querySelector(`#alignment-${name}`);
  const browser = get('browser'), chart = get('chart');
  const cache = new Map();
  let data, target = 0, initialized = false, request = 0, plot, guide;
  const percent = value => `${new Intl.NumberFormat('en', {maximumFractionDigits: 1}).format(value * 100)}%`;

  function nearestFrame(trajectory, progress) {
    // Strict comparison keeps the earlier frame when distances are exactly equal.
    return trajectory.frames.reduce((best, frame) =>
      Math.abs(frame.progress - progress) < Math.abs(best.progress - progress) ? frame : best);
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

  async function showMatches() {
    const currentRequest = ++request;
    const selectedTarget = target;
    const matches = data.trajectories.map(trajectory => nearestFrame(trajectory, selectedTarget / 100));
    get('frames').setAttribute('aria-busy', 'true');
    get('frame-error').hidden = true;
    get('frame-retry').hidden = true;
    matches.forEach((_, index) => {
      get(`image-${index}`).hidden = true;
    });
    try {
      const images = await Promise.all(matches.map(loadImage));
      if (currentRequest !== request) return;
      matches.forEach((frame, index) => {
        const image = get(`image-${index}`);
        image.src = images[index].src;
        image.alt = `${data.task}, ${data.trajectories[index].name}, frame ${frame.frame_index + 1}, progress ${percent(frame.progress)}, closest to ${selectedTarget}%.`;
        image.dataset.frameIndex = frame.frame_index;
        image.dataset.target = selectedTarget;
        image.hidden = false;
      });
      get('frames').setAttribute('aria-busy', 'false');
      // Buffer adjacent target matches; do not fetch every trajectory frame up front.
      for (const next of [selectedTarget - 5, selectedTarget + 5].filter(value => value >= 0 && value <= 100)) {
        data.trajectories.forEach(trajectory => { loadImage(nearestFrame(trajectory, next / 100)).catch(() => {}); });
      }
    } catch {
      if (currentRequest !== request) return;
      get('frames').setAttribute('aria-busy', 'false');
      get('frame-error').hidden = false;
      get('frame-retry').hidden = false;
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
    get('chart-description').textContent = `Two full progress curves. The horizontal dashed line is at ${target}%. Each image is the frame with the smallest absolute difference from this target, independently for each trajectory.`;
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

  const milestoneThresholds = [0, 25, 50, 75, 95];
  const milestoneDescriptions = [
    'The robot arm starts moving.',
    'Ready to start pushing the drawer.',
    'The drawer is more than halfway closed.',
    'The drawer is almost fully closed.',
    'The drawer is fully closed.',
  ];

  function setTarget(value) {
    target = Math.max(0, Math.min(100, Math.round(value / 5) * 5));
    get('target').value = `${target}%`;
    get('up').disabled = target === 100;
    get('down').disabled = target === 0;
    const milestone = milestoneThresholds.filter(threshold => target >= threshold).length - 1;
    const description = `Progress ${milestoneThresholds[milestone]}%: ${milestoneDescriptions[milestone]}`;
    if (get('event-text').textContent !== description) get('event-text').textContent = description;
    updateGuide();
    showMatches();
  }
  get('up').addEventListener('click', () => setTarget(target + 5));
  get('down').addEventListener('click', () => setTarget(target - 5));
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
      const response = await fetch(new URL('assets/capabilities/semantic-alignment/index.json', document.baseURI));
      if (!response.ok) throw new Error('Progress data unavailable');
      data = await response.json();
      if (data.trajectories?.length !== 2 || data.trajectories.some(t => !t.frames?.length || t.frames.some(f => !Number.isFinite(f.progress) || f.progress < 0 || f.progress > 1))) throw new Error('Invalid progress data');
      browser.hidden = false;
      get('loading').hidden = true;
      drawChart();
      setTarget(0);
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
