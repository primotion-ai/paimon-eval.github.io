// One human reference, followed by YAM, paired Wuji outcomes, and the human query.
(() => {
  const root = document.querySelector('#transfer-demo');
  if (!root) return;
  const get = name => root.querySelector(`#transfer-${name}`);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const stages = [
    { name: 'reference', duration: 2560, text: 'Start with one successful human reference.' },
    { name: 'keyframes', duration: 1500, text: 'Four keyframes define the shared progress scale.' },
    { name: 'model', duration: 900, text: 'Yuheng reads the reference context.' },
    { name: 'yam', duration: 5760, group: 'yam', text: 'Evaluate a YAM arm using the human reference.' },
    { name: 'yam-hold', duration: 600, group: 'yam', text: 'The YAM arm completes the task.' },
    { name: 'wuji', duration: 5760, group: 'wuji', text: 'Compare successful and failed Wuji executions together.' },
    { name: 'wuji-hold', duration: 600, group: 'wuji', text: 'The shared scale distinguishes the two outcomes.' },
    { name: 'human', duration: 5760, group: 'human', text: 'Evaluate the human trajectory on the same scale.' },
    { name: 'summary', duration: 4000, group: 'human', text: 'Different embodiments. One reference scale.' },
  ];
  let duration = 0;
  stages.forEach(stage => { stage.start = duration; duration += stage.duration; });
  const groups = { yam: ['3'], wuji: ['5', '7'], human: ['1'] };
  const groupNames = { yam: 'YAM arm', wuji: 'Wuji hand · success vs. failure', human: 'Human hand' };
  const descriptions = {
    '3': ['YAM arm · Success', 'Robot arm execution · Trajectory 3'],
    '5': ['Wuji hand · Success', 'Completes the task · Trajectory 5'],
    '7': ['Wuji hand · Failure', 'Incomplete task · Trajectory 7'],
    '1': ['Human hand', 'The reference evaluated as a query · Trajectory 1'],
  };
  let data, trajectories, frames, initialized = false, ready = false, inView = false;
  let paused = reducedMotion.matches, elapsed = 0, lastTime = null, animationId = null, lastRender = '';
  const cards = {}, rows = {};
  let resizeObserver;
  const percent = value => `${Math.round(value * 100)}%`;

  function stateAt(time) {
    const t = Math.min(time, duration - 1);
    const stage = stages.find(s => t < s.start + s.duration);
    const local = t - stage.start;
    const frame = stage.name === 'reference' ? Math.min(31, Math.floor(local / 80))
      : ['yam', 'wuji', 'human'].includes(stage.name) ? Math.min(31, Math.floor(local / 180))
      : stage.group ? 31 : 0;
    const revealed = stage.name === 'reference' ? 0 : stage.name === 'keyframes' ? Math.min(4, 1 + Math.floor(local / 300)) : 4;
    return { ...stage, frame, revealed };
  }
  function svg(name, attributes, text) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function drawChart(row) {
    const { chart, ids } = row;
    const w = chart.clientWidth, h = chart.clientHeight;
    if (!w || !h) return;
    const left = 45, right = w - 12, top = 12, bottom = h - 30;
    row.plot = { width: w, height: h, left, x: frame => left + (right - left) * frame / 31, y: value => bottom - (bottom - top) * value };
    const plot = row.plot;
    chart.setAttribute('viewBox', `0 0 ${w} ${h}`);
    chart.querySelectorAll(':scope > :not(title):not(desc)').forEach(node => node.remove());
    [0, .25, .5, .75, 1].forEach(value => {
      chart.append(svg('line', { x1: left, x2: right, y1: plot.y(value), y2: plot.y(value), class: 'transfer-gridline' }));
      chart.append(svg('text', { x: left - 7, y: plot.y(value) + 4, 'text-anchor': 'end', class: 'transfer-axis-label' }, percent(value)));
    });
    chart.append(svg('text', { x: left, y: bottom + 22, class: 'transfer-axis-label' }, 'Start'));
    chart.append(svg('text', { x: right, y: bottom + 22, 'text-anchor': 'end', class: 'transfer-axis-label' }, 'End'));
    const defs = svg('defs', {});
    chart.append(defs);
    row.clips = {}; row.dots = {};
    ids.forEach(id => {
      const t = trajectories[id];
      const clip = svg('clipPath', { id: `transfer-story-clip-${id}`, clipPathUnits: 'userSpaceOnUse' });
      row.clips[id] = svg('rect', { x: left - 3, y: 0, width: 0, height: h });
      clip.append(row.clips[id]); defs.append(clip);
      chart.append(svg('polyline', { class: 'transfer-story-curve', 'data-trajectory': id, stroke: t.color,
        points: t.frames.map((f, i) => `${plot.x(i)},${plot.y(f.progress)}`).join(' '), 'clip-path': `url(#transfer-story-clip-${id})` }));
      row.dots[id] = svg('circle', { r: 4.5, class: 'transfer-story-dot', fill: t.color, 'data-trajectory': id });
    });
    row.cursor = svg('line', { y1: top, y2: bottom, class: 'transfer-cursor' });
    chart.append(row.cursor, ...Object.values(row.dots));
  }
  function makeCards() {
    get('keyframes').replaceChildren(); get('output').replaceChildren();
    resizeObserver?.disconnect();
    data.reference.frame_indices.forEach((frame, i) => {
      const card = document.createElement('div'); card.className = 'transfer-keyframe';
      const image = document.createElement('img'); image.src = frames['1'][frame].src; image.width = 320; image.height = 256;
      image.alt = `Human reference keyframe ${i + 1}, assigned progress ${percent(data.reference.progress[i])}`;
      const label = document.createElement('p'); label.append('Progress: ');
      const value = document.createElement('strong'); value.textContent = percent(data.reference.progress[i]); label.append(value);
      card.append(image, label); get('keyframes').append(card);
    });
    Object.entries(groups).forEach(([group, ids]) => {
      const section = document.createElement('section'); section.className = 'transfer-result-row'; section.dataset.group = group; section.hidden = true;
      section.setAttribute('aria-labelledby', `transfer-title-${group}`);
      const panel = document.createElement('div'); panel.className = 'transfer-query-panel';
      const heading = document.createElement('div'); heading.className = 'transfer-query-heading';
      const title = document.createElement('h4'); title.id = `transfer-title-${group}`; title.textContent = groupNames[group];
      const counter = document.createElement('span'); counter.className = 'transfer-frame-counter';
      heading.append(title, counter);
      const framePanel = document.createElement('div'); framePanel.className = 'transfer-query-frames';
      panel.append(heading, framePanel);
      const chartPanel = document.createElement('div'); chartPanel.className = 'transfer-story-chart';
      const legend = document.createElement('div'); legend.className = 'transfer-legend'; legend.setAttribute('aria-label', 'Trajectory colors');
      const chart = svg('svg', { class: 'transfer-result-chart', role: 'img', 'aria-labelledby': `transfer-chart-title-${group} transfer-chart-description-${group}` });
      chart.append(svg('title', { id: `transfer-chart-title-${group}` }, `${groupNames[group]} progress`));
      const description = svg('desc', { id: `transfer-chart-description-${group}` }); chart.append(description);
      chartPanel.append(legend, chart); section.append(panel, chartPanel); get('output').append(section);
      rows[group] = { section, chart, description, counter, ids };
      ids.forEach(id => {
        const t = trajectories[id];
        const card = document.createElement('div'); card.className = 'transfer-query-card'; card.dataset.trajectory = id;
        card.classList.toggle('is-single', ids.length === 1); card.style.setProperty('--trajectory-color', t.color);
        const cardTitle = document.createElement('h5'); cardTitle.textContent = descriptions[id][0];
        const image = document.createElement('img'); image.width = 320; image.height = 256;
        const caption = document.createElement('p'); caption.textContent = descriptions[id][1];
        const output = document.createElement('output'); output.setAttribute('aria-label', `${t.name} predicted progress`);
        card.append(cardTitle, image, caption, output); framePanel.append(card); cards[id] = { card, image, output };
        const item = document.createElement('span');
        const swatch = document.createElement('i'); swatch.style.background = t.color; swatch.setAttribute('aria-hidden', 'true');
        item.append(swatch, descriptions[id][0]); legend.append(item);
      });
      resizeObserver?.observe(chart);
    });
  }
  function showImage(image, id, frame) {
    if (image.dataset.frame === String(frame)) return;
    image.src = frames[id][frame].src;
    image.dataset.frame = frame;
    image.alt = `${data.task} ${trajectories[id].name}, frame ${frame + 1} of 32.`;
  }
  function render(force = false) {
    if (!ready) return;
    const state = stateAt(elapsed);
    const key = `${state.name}:${state.frame}:${state.revealed}`;
    if (!force && key === lastRender) return;
    lastRender = key;
    root.dataset.stage = state.name; root.dataset.frame = state.frame;
    if (get('status').textContent !== state.text) get('status').textContent = state.text;
    showImage(get('reference-image'), '1', state.name === 'reference' ? state.frame : 31);
    get('arrow-keyframes').classList.toggle('is-visible', state.name !== 'reference');
    [...get('keyframes').children].forEach((card, i) => {
      card.classList.toggle('is-visible', i < state.revealed);
      card.setAttribute('aria-hidden', String(i >= state.revealed));
    });
    const modelVisible = state.name === 'model' || Boolean(state.group);
    get('arrow-model').classList.toggle('is-visible', modelVisible);
    get('model').classList.toggle('is-visible', modelVisible);
    get('model').classList.toggle('is-evaluating', Boolean(state.group) && state.name !== 'summary');
    get('model').setAttribute('aria-hidden', String(!modelVisible));
    const activeGroup = Object.keys(groups).indexOf(state.group);
    Object.entries(rows).forEach(([group, row], index) => {
      const visible = index <= activeGroup;
      row.section.hidden = !visible;
      if (!visible) return;
      const current = group === state.group;
      const frame = current ? state.frame : 31;
      row.section.dataset.frame = frame;
      row.section.classList.toggle('is-playing', current && ['yam', 'wuji', 'human'].includes(state.name));
      row.counter.textContent = `Frame ${frame + 1} / 32`;
      if (!row.plot || row.plot.width !== row.chart.clientWidth || row.plot.height !== row.chart.clientHeight) drawChart(row);
      if (!row.plot) return;
      const { plot } = row;
      row.ids.forEach(id => {
        const item = cards[id];
        showImage(item.image, id, frame);
        item.output.value = `Progress: ${percent(trajectories[id].frames[frame].progress)}`;
        row.clips[id].setAttribute('width', plot.x(frame) - plot.left + 3);
        row.dots[id].setAttribute('cx', plot.x(frame));
        row.dots[id].setAttribute('cy', plot.y(trajectories[id].frames[frame].progress));
      });
      row.cursor.setAttribute('x1', plot.x(frame)); row.cursor.setAttribute('x2', plot.x(frame));
      row.cursor.style.opacity = current && state.name !== 'summary' ? '1' : '0';
      row.description.textContent = `${groupNames[group]}. Frame ${frame + 1} of 32. Progress curves are revealed with the corresponding images and remain visible after playback.`;
    });
    root.querySelectorAll('[data-stage]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.stage === (state.group || 'reference')));
    });
  }

  function canPlay() { return ready && inView && !paused && !document.hidden; }
  function tick(now) {
    animationId = null;
    if (!canPlay()) { lastTime = null; return; }
    if (lastTime !== null) elapsed = Math.min(elapsed + now - lastTime, duration - 1);
    lastTime = now; render();
    if (elapsed >= duration - 1) { paused = true; syncPlayback(); return; }
    animationId = requestAnimationFrame(tick);
  }
  function syncPlayback() {
    const replay = paused && stateAt(elapsed).name === 'summary';
    get('play').textContent = replay ? 'Replay' : paused ? 'Play' : 'Pause';
    get('play').setAttribute('aria-label', replay ? 'Replay cross-embodiment animation' : paused ? 'Play cross-embodiment animation' : 'Pause cross-embodiment animation');
    if (!canPlay()) {
      if (animationId !== null) cancelAnimationFrame(animationId);
      animationId = null; lastTime = null;
    } else if (animationId === null) { lastTime = null; animationId = requestAnimationFrame(tick); }
  }
  function restart(stage = 'reference') {
    elapsed = stages.find(s => s.name === stage).start; lastTime = null; paused = false; render(true); syncPlayback();
  }
  get('play').addEventListener('click', () => {
    if (paused && stateAt(elapsed).name === 'summary') restart();
    else { paused = !paused; syncPlayback(); }
  });
  get('restart').addEventListener('click', () => restart());
  root.querySelectorAll('[data-stage]').forEach(button => button.addEventListener('click', () => restart(button.dataset.stage)));
  document.addEventListener('visibilitychange', syncPlayback);
  reducedMotion.addEventListener('change', event => {
    if (event.matches) { paused = true; elapsed = duration - 1000; render(true); syncPlayback(); }
  });
  function loadImage(frame) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => image.decode().then(() => resolve(image), reject);
      image.onerror = () => reject(new Error('Frame unavailable'));
      image.src = new URL(frame.image_path, document.baseURI).href;
    });
  }
  async function initialize() {
    if (initialized) return;
    initialized = true; get('retry').hidden = true; get('loading').hidden = false;
    root.setAttribute('aria-busy', 'true'); get('status').textContent = 'Loading trajectories…';
    try {
      const response = await fetch(new URL('assets/capabilities/cross-embodiment/index.json?v=20261104-story', document.baseURI));
      if (!response.ok) throw new Error('Data unavailable');
      data = await response.json();
      if (data.trajectories?.length !== 4 || data.reference?.trajectory_id !== '1' || data.reference.frame_indices.length !== 4 || data.reference.progress.length !== 4 || data.trajectories.some(t => t.frames.length !== 32 || t.frames.some((f, i) => f.frame_index !== i || !Number.isFinite(f.progress) || f.progress < 0 || f.progress > 1))) throw new Error('Invalid trajectories');
      trajectories = Object.fromEntries(data.trajectories.map(t => [t.id, t]));
      if (['1', '3', '5', '7'].some(id => !trajectories[id])) throw new Error('Missing trajectory');
      frames = Object.fromEntries(await Promise.all(data.trajectories.map(async t => [t.id, await Promise.all(t.frames.map(loadImage))])));
      makeCards(); ready = true; get('browser').hidden = false; get('loading').hidden = true;
      get('play').disabled = get('restart').disabled = false;
      if (reducedMotion.matches) elapsed = duration - 1000;
      render(true); syncPlayback();
    } catch {
      initialized = false; ready = false; get('browser').hidden = true;
      get('loading').textContent = 'Trajectories could not be loaded. Please retry.';
      get('status').textContent = 'Unable to load the animation.'; get('retry').hidden = false;
    } finally { root.setAttribute('aria-busy', 'false'); }
  }
  get('retry').addEventListener('click', initialize);
  if ('ResizeObserver' in window) resizeObserver = new ResizeObserver(() => render(true));
  else window.addEventListener('resize', () => render(true));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { inView = entries.some(e => e.isIntersecting); if (inView) initialize(); syncPlayback(); }).observe(root);
  } else { inView = true; initialize(); }
})();
