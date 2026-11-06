// A single-pass introduction using the reference and Human hand sequence from section 3.3.
(() => {
  const root = document.querySelector('#concept-overview');
  if (!root) return;
  const get = name => root.querySelector(`#concept-${name}`);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const duration = 15000, queryStart = 4900, queryFrameDuration = 180;
  let ready = false, initialized = false, visible = false, paused = reducedMotion.matches;
  let elapsed = 0, lastTime = null, raf = null, images, cards = [], lastPhase = '';
  const rows = [...root.querySelectorAll('.concept-result')];
  const ramp = (time, start, length = 600) => Math.max(0, Math.min(1, (time - start) / length));
  const ease = value => value * value * (3 - 2 * value);
  const fade = (node, opacity, lift = 0) => {
    node.style.opacity = opacity;
    if (lift) node.style.transform = `translateY(${(1 - opacity) * lift}px)`;
  };
  function render() {
    if (!ready) return;
    const t = elapsed, final = ramp(t, 14000);
    const referenceFocus = 1 - .28 * ramp(t, 4300) * (1 - final);
    fade(get('reference'), ease(ramp(t, 0)), 8);
    get('reference').style.opacity = ease(ramp(t, 0)) * referenceFocus;
    cards.forEach((card, i) => fade(card, ease(ramp(t, 700 + i * 900)), 10));
    const queryOpacity = ease(ramp(t, 4300)) * (1 - .25 * ramp(t, 11000) * (1 - final));
    fade(get('query'), queryOpacity);
    fade(get('model'), ease(ramp(t, 4300)));
    fade(get('input-arrow'), ease(ramp(t, 4300)));
    const frame = Math.max(0, Math.min(31, Math.floor((t - queryStart) / queryFrameDuration)));
    const image = get('query-image');
    if (image.dataset.frame !== String(frame)) {
      image.src = images[frame].src; image.dataset.frame = frame;
      image.alt = `Human hand reference query, frame ${frame + 1} of 32`;
    }
    image.hidden = false;
    fade(get('output'), ease(ramp(t, 11000)));
    fade(get('output-arrow'), ease(ramp(t, 11000)));
    rows.forEach((row, i) => {
      fade(row.querySelector('.concept-result-label'), ease(ramp(t, 11400 + i * 150)));
      const progress = ease(ramp(t, 12100, 1900)) * Number(row.dataset.target);
      row.querySelector('i').style.width = `${progress}%`;
    });
    const phase = t < 700 ? 'reference' : t < 4300 ? 'keyframes' : t < 11000 ? 'query' : t < 14000 ? 'output' : 'complete';
    root.dataset.phase = phase;
    if (phase !== lastPhase) {
      lastPhase = phase;
      get('status').textContent = {reference: 'Define your reference scale.', keyframes: 'Four reference keyframes define the progress scale.', query: 'Play the human hand query trajectory.', output: 'Evaluate successful, suboptimal, and failed trajectories.', complete: 'Overview complete. Replay to watch again.'}[phase];
    }
  }
  function canPlay() { return ready && visible && !paused && !document.hidden && elapsed < duration; }
  function tick(now) {
    raf = null;
    if (!canPlay()) { lastTime = null; return; }
    if (lastTime !== null) elapsed = Math.min(duration, elapsed + now - lastTime);
    lastTime = now; render();
    if (elapsed === duration) { paused = true; sync(); return; }
    raf = requestAnimationFrame(tick);
  }
  function sync() {
    get('play').textContent = elapsed === duration ? 'Replay' : paused ? 'Play' : 'Pause';
    get('play').setAttribute('aria-label', `${elapsed === duration ? 'Replay' : paused ? 'Play' : 'Pause'} conceptual overview`);
    if (!canPlay()) { if (raf !== null) cancelAnimationFrame(raf); raf = null; lastTime = null; }
    else if (raf === null) { lastTime = null; raf = requestAnimationFrame(tick); }
  }
  function restart() { elapsed = 0; lastTime = null; paused = false; render(); sync(); }
  get('play').addEventListener('click', () => { if (elapsed === duration) restart(); else { paused = !paused; sync(); } });
  get('restart').addEventListener('click', restart);
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', event => { if (event.matches) { paused = true; elapsed = duration; render(); sync(); } });
  function loadImage(path) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => image.decode().then(() => resolve(image), reject);
      image.onerror = () => reject(new Error('Image unavailable'));
      image.src = new URL(path, document.baseURI).href;
    });
  }
  async function initialize() {
    if (initialized) return;
    initialized = true; get('retry').hidden = true;
    try {
      const response = await fetch(new URL('assets/capabilities/cross-embodiment/index.json', document.baseURI));
      if (!response.ok) throw new Error('Reference data unavailable');
      const data = await response.json();
      const human = data.trajectories.find(t => t.id === '1');
      if (human?.frames.length !== 32 || data.reference.frame_indices.length !== 4 || data.reference.progress.length !== 4) throw new Error('Invalid reference');
      images = await Promise.all(human.frames.map(f => loadImage(f.image_path)));
      get('keyframes').replaceChildren();
      cards = data.reference.frame_indices.map((frame, i) => {
        const card = document.createElement('div'); card.className = 'concept-keyframe';
        const name = document.createElement('small'); name.textContent = `Frame ${String(i + 1).padStart(2, '0')}`;
        const image = document.createElement('img'); image.width = 320; image.height = 256; image.src = images[frame].src;
        image.alt = `Human reference keyframe ${i + 1}`; image.dataset.frame = frame;
        const label = document.createElement('span'); label.textContent = `${Math.round(data.reference.progress[i] * 100)}%`;
        card.append(name, image, label); get('keyframes').append(card); return card;
      });
      ready = true; root.dataset.ready = 'true';
      get('play').disabled = get('restart').disabled = false;
      if (reducedMotion.matches) elapsed = duration;
      render(); sync();
    } catch {
      initialized = false; get('status').textContent = 'Reference frames could not be loaded. Please retry.';
      get('retry').hidden = false;
    }
  }
  get('retry').addEventListener('click', initialize);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries.some(e => e.isIntersecting);
      if (visible) initialize(); sync();
    }).observe(root);
  } else { visible = true; initialize(); }
})();
