// Timed, synchronized playback of one trajectory under two reference scales.
(() => {
  const root = document.querySelector('#scale-animation');
  if (!root) return;
  const get = name => root.querySelector(`#scale-animation-${name}`);
  const chart = get('chart');
  const keyframes = [...root.querySelectorAll('.scale-animation-keyframe')];
  const legends = [...root.querySelectorAll('[data-scale]')];
  const colors = ['#c6533b', '#3978b7'];
  const base = new URL('assets/capabilities/different-progress-scale/', document.baseURI);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const stages = [
    { phase: 'reveal', condition: 0, duration: 2400, text: 'One successful reference. Three keyframes.' },
    { phase: 'labels', condition: 0, duration: 1200, text: 'Keyframe progress: 0% · 20% · 100%' },
    { phase: 'play', condition: 0, duration: 8000, text: 'Follow progress on the first reference scale.' },
    { phase: 'hold', condition: 0, duration: 1100, text: 'Same trajectory. Now change the scale.' },
    { phase: 'labels', condition: 1, duration: 1200, text: 'Keyframe progress: 0% · 60% · 100%' },
    { phase: 'play', condition: 1, duration: 8000, text: 'Follow progress on the new reference scale.' },
    { phase: 'hold', condition: 1, duration: 4600, text: 'Compare both progress scales.' },
  ];
  const cycle = stages.reduce((sum, stage) => sum + stage.duration, 0);
  let data, loadedFrames, initialized = false, ready = false, inView = false;
  let paused = reducedMotion.matches, elapsed = 0, lastTime = null, animationId = null;
  let lastRender = '', plot, cursor, dot, curves = [], clips = [], markers = [];
  const percent = value => `${Math.round(value * 100)}%`;

  function stateAt(time) {
    let remaining = time % cycle;
    for (const stage of stages) {
      if (remaining < stage.duration) {
        const frame = stage.phase === 'play' ? Math.min(31, Math.floor(remaining / 250)) : stage.phase === 'hold' ? 31 : 0;
        return { ...stage, frame, revealed: stage.phase === 'reveal' ? Math.min(3, Math.floor(remaining / 650)) : 3 };
      }
      remaining -= stage.duration;
    }
  }

  function svg(name, attributes, text) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function drawChart() {
    if (!ready || !chart.clientWidth) return;
    const width = chart.clientWidth, height = chart.clientHeight;
    const left = 46, right = width - 12, top = 15, bottom = height - 38;
    plot = { left, right, top, bottom, x: frame => left + (right - left) * frame / 31, y: value => bottom - (bottom - top) * value };
    chart.setAttribute('viewBox', `0 0 ${width} ${height}`);
    chart.querySelectorAll(':scope > :not(title):not(desc)').forEach(node => node.remove());
    [0, .25, .5, .75, 1].forEach(value => {
      chart.append(svg('line', { x1: left, y1: plot.y(value), x2: right, y2: plot.y(value), class: 'scale-animation-gridline' }));
      chart.append(svg('text', { x: left - 8, y: plot.y(value) + 4, 'text-anchor': 'end', class: 'scale-animation-axis' }, percent(value)));
    });
    chart.append(svg('text', { x: left, y: bottom + 25, class: 'scale-animation-axis' }, 'Start'));
    chart.append(svg('text', { x: right, y: bottom + 25, 'text-anchor': 'end', class: 'scale-animation-axis' }, 'End'));
    const defs = svg('defs', {});
    curves = []; clips = []; markers = [];
    data.curves.forEach((curve, index) => {
      const clip = svg('clipPath', { id: `scale-animation-clip-${index}`, clipPathUnits: 'userSpaceOnUse' });
      const rect = svg('rect', { x: left - 3, y: 0, width: 0, height });
      clip.append(rect); defs.append(clip); clips.push(rect);
      const line = svg('polyline', { points: curve.progress.map((value, frame) => `${plot.x(frame)},${plot.y(value)}`).join(' '),
        class: 'scale-animation-curve', stroke: colors[index], 'clip-path': `url(#scale-animation-clip-${index})` });
      curves.push(line);
      const group = svg('g', { class: 'scale-animation-markers', stroke: colors[index], 'data-condition': index });
      data.reference_frame_indices.forEach((frame, keyframe) => {
        const x = plot.x(frame), y = plot.y(curve.progress[frame]);
        const marker = index === 0
          ? svg('circle', { cx: x, cy: y, r: 6, class: 'scale-animation-marker' })
          : svg('path', { d: `M${x} ${y - 4.5}l4.5 4.5-4.5 4.5-4.5-4.5Z`, class: 'scale-animation-marker' });
        marker.dataset.keyframe = keyframe;
        marker.append(svg('title', {}, `Keyframe ${keyframe + 1}: reference ${percent(curve.reference_progress[keyframe])}, predicted progress ${(curve.progress[frame] * 100).toFixed(1)}%`));
        group.append(marker);
      });
      markers.push(group);
    });
    cursor = svg('line', { y1: top, y2: bottom, class: 'scale-animation-cursor' });
    dot = svg('circle', { r: 5, class: 'scale-animation-dot' });
    chart.append(defs, ...curves, ...markers, cursor, dot);
    render(true);
  }

  function render(force = false) {
    if (!ready || !plot) return;
    const state = stateAt(elapsed);
    const { phase, condition, frame, revealed } = state;
    const finalComparison = phase === 'hold' && condition === 1;
    const key = `${phase}:${condition}:${frame}:${revealed}`;
    if (!force && key === lastRender) return;
    lastRender = key;
    root.dataset.phase = phase; root.dataset.condition = condition; root.dataset.frame = frame;
    root.style.setProperty('--scale-color', colors[condition]);
    root.classList.toggle('labels-visible', phase !== 'reveal');
    keyframes.forEach((card, index) => {
      card.classList.toggle('is-visible', index < revealed);
      card.setAttribute('aria-hidden', String(index >= revealed));
      card.querySelectorAll('.scale-animation-badge').forEach((badge, scale) => {
        // Keep the text mounted so both sets of values can fade instead of popping in.
        badge.textContent = percent(data.curves[scale].reference_progress[index]);
        badge.classList.toggle('is-active', finalComparison || scale === condition);
        badge.setAttribute('aria-label', `${scale === 0 ? 'First' : 'Second'} scale: ${badge.textContent}`);
      });
    });
    legends.forEach((legend, index) => legend.classList.toggle('is-active', phase !== 'reveal' && (finalComparison || index === condition)));
    if (get('status').textContent !== state.text) get('status').textContent = state.text;
    const image = get('image');
    if (image.dataset.frame !== String(frame)) {
      image.src = loadedFrames[frame].src;
      image.dataset.frame = frame;
      image.alt = `Close the drawer — trajectory frame ${frame + 1} of 32`;
    }
    image.hidden = false;
    get('frame').textContent = `Frame ${frame + 1} / 32`;
    const showingProgress = phase === 'play' || phase === 'hold';
    const value = data.curves[condition].progress[frame];
    root.classList.toggle('progress-visible', showingProgress);
    get('progress').value = percent(value);
    curves.forEach((line, index) => {
      const previous = condition === 1 && index === 0;
      const active = showingProgress && index === condition;
      line.style.opacity = finalComparison ? '1' : previous ? '.24' : active ? '1' : '0';
      clips[index].setAttribute('width', previous ? plot.right - plot.left + 6 : active ? plot.x(frame) - plot.left + 3 : 0);
    });
    markers.forEach((group, scale) => {
      group.style.opacity = phase !== 'reveal' && (finalComparison || scale === condition) ? '1' : '.24';
      [...group.children].forEach((marker, index) => { marker.style.opacity = index < revealed ? '1' : '0'; });
    });
    cursor.style.opacity = dot.style.opacity = showingProgress ? '1' : '0';
    cursor.setAttribute('x1', plot.x(frame)); cursor.setAttribute('x2', plot.x(frame));
    dot.setAttribute('cx', plot.x(frame)); dot.setAttribute('cy', plot.y(value)); dot.setAttribute('fill', colors[condition]);
    get('chart-description').textContent = `Reference labels ${data.curves[condition].reference_progress.map(percent).join(', ')}. Frame ${frame + 1} of 32${showingProgress ? `, predicted progress ${percent(value)}` : ''}. Markers show model predictions at the three reference keyframes; red circles use the first scale and blue diamonds use the second. The curve is revealed together with the trajectory frames.`;
  }

  function canPlay() { return ready && inView && !paused && !document.hidden; }
  function tick(now) {
    animationId = null;
    if (!canPlay()) { lastTime = null; return; }
    if (lastTime !== null) elapsed = (elapsed + now - lastTime) % cycle;
    lastTime = now;
    render();
    animationId = requestAnimationFrame(tick);
  }
  function syncPlayback() {
    get('toggle').textContent = paused ? 'Play' : 'Pause';
    get('toggle').setAttribute('aria-label', paused ? 'Play scale animation' : 'Pause scale animation');
    if (!canPlay()) {
      if (animationId !== null) cancelAnimationFrame(animationId);
      animationId = null; lastTime = null;
    } else if (animationId === null) {
      lastTime = null;
      animationId = requestAnimationFrame(tick);
    }
  }
  get('toggle').addEventListener('click', () => { paused = !paused; syncPlayback(); });
  get('restart').addEventListener('click', () => { elapsed = 0; lastTime = null; paused = false; render(true); syncPlayback(); });
  document.addEventListener('visibilitychange', syncPlayback);
  reducedMotion.addEventListener('change', event => {
    if (event.matches) { paused = true; elapsed = cycle - 1000; render(true); syncPlayback(); }
  });

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => image.decode().then(() => resolve(image), reject);
      image.onerror = () => reject(new Error('Frame unavailable'));
      image.src = url;
    });
  }
  async function initialize() {
    if (initialized) return;
    initialized = true;
    get('error').hidden = get('retry').hidden = true;
    root.setAttribute('aria-busy', 'true');
    get('status').textContent = 'Loading the trajectory…';
    try {
      const response = await fetch(new URL('results.json?v=20261103-animation', base));
      if (!response.ok) throw new Error('Data unavailable');
      data = await response.json();
      if (data.frames?.length !== 32 || data.curves?.length !== 2 || data.curves.some(curve => curve.progress.length !== 32 || curve.reference_progress.length !== 3 || curve.progress.some(value => !Number.isFinite(value) || value < 0 || value > 1))) throw new Error('Invalid scale data');
      loadedFrames = await Promise.all(data.frames.map(frame => loadImage(new URL(frame.image_path, base).href)));
      await Promise.all(keyframes.map(card => loadImage(card.querySelector('img').src)));
      get('content').hidden = false;
      get('toggle').disabled = get('restart').disabled = false;
      ready = true;
      if (reducedMotion.matches) elapsed = cycle - 1000;
      drawChart(); syncPlayback();
    } catch {
      initialized = false;
      get('status').textContent = 'The animation could not be loaded.';
      get('error').hidden = get('retry').hidden = false;
    } finally { root.setAttribute('aria-busy', 'false'); }
  }
  get('retry').addEventListener('click', initialize);
  if ('ResizeObserver' in window) new ResizeObserver(drawChart).observe(chart);
  else window.addEventListener('resize', drawChart);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      inView = entries.some(entry => entry.isIntersecting);
      if (inView) initialize();
      syncPlayback();
    }).observe(root);
  } else { inView = true; initialize(); }
})();
