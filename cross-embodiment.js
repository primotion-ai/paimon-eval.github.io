// Four independently sampled trajectories share a frame position, not physical timestamps.
(() => {
  const root = document.querySelector('#transfer-demo');
  if (!root) return;
  const get = name => root.querySelector(`#transfer-${name}`);
  const chart = get('chart'), browser = get('browser'), cache = new Map();
  let data, initialized = false, currentFrame = 0, requestedFrame = 0, request = 0;
  let playing = false, timer, plot, cursor, pastClip, futureClip;
  const images = [];
  const lastFrame = () => data.trajectories[0].frames.length - 1;

  function updateControls() {
    get('previous').disabled = requestedFrame === 0;
    get('next').disabled = requestedFrame === lastFrame();
    get('play').textContent = playing ? 'Pause' : currentFrame === lastFrame() ? 'Replay' : 'Play';
  }
  function pause() {
    playing = false;
    clearTimeout(timer);
    request += 1;
    requestedFrame = currentFrame;
    get('frames').setAttribute('aria-busy', 'false');
    if (data) updateControls();
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
  function updateCursor() {
    if (!plot || !cursor) return;
    const x = plot.x(currentFrame);
    cursor.setAttribute('x1', x); cursor.setAttribute('x2', x);
    pastClip.setAttribute('width', currentFrame === 0 ? 0 : x - plot.left + 3);
    futureClip.setAttribute('x', x);
    futureClip.setAttribute('width', currentFrame === lastFrame() ? 0 : plot.right - x + 3);
    get('chart-description').textContent = `Frame ${currentFrame + 1} of ${lastFrame() + 1}. Human hand reference, YAM arm, successful Wuji hand and failed Wuji hand trajectories. All curves are continuous; frames up to the cursor are fully opaque and future frames are faded.`;
  }
  async function showFrame(index) {
    const version = ++request;
    requestedFrame = Math.max(0, Math.min(lastFrame(), index));
    const target = requestedFrame;
    updateControls();
    get('frames').setAttribute('aria-busy', 'true');
    get('frame-error').hidden = true;
    get('frame-retry').hidden = true;
    try {
      const loaded = await Promise.all(data.trajectories.map(t => loadImage(t.frames[target])));
      if (version !== request) return false;
      // Commit all four decoded images and the cursor together.
      currentFrame = target;
      images.forEach((image, i) => {
        image.src = loaded[i].src;
        image.alt = `${data.task} ${data.trajectories[i].name}, ${data.trajectories[i].role}, frame ${target + 1}.`;
        image.dataset.frame = target;
        image.hidden = false;
      });
      get('frames').setAttribute('aria-busy', 'false');
      get('frame-counter').textContent = `Frame ${target + 1} / ${lastFrame() + 1}`;
      get('play').disabled = false;
      updateControls(); updateCursor();
      for (const next of [target + 1, target + 2].filter(f => f <= lastFrame())) {
        data.trajectories.forEach(t => { loadImage(t.frames[next]).catch(() => {}); });
      }
      return true;
    } catch {
      if (version !== request) return false;
      pause();
      requestedFrame = target;
      get('frame-error').hidden = false;
      get('frame-retry').hidden = false;
      return false;
    }
  }
  function svg(name, attributes, text) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key,value]) => element.setAttribute(key,value));
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function drawChart() {
    if (!data || browser.hidden) return;
    const width = chart.clientWidth, height = chart.clientHeight;
    if (!width || !height) return;
    chart.setAttribute('viewBox', `0 0 ${width} ${height}`);
    chart.querySelectorAll(':scope > :not(title):not(desc)').forEach(node => node.remove());
    const left = 45, right = width - 12, top = 12, bottom = height - 42;
    plot = {left, right, x: i => left + (right-left)*i/lastFrame(), y: p => bottom-(bottom-top)*p};
    [0,.25,.5,.75,1].forEach(p => {
      chart.append(svg('line',{x1:left,x2:right,y1:plot.y(p),y2:plot.y(p),class:'transfer-gridline'}));
      chart.append(svg('text',{x:left-7,y:plot.y(p)+5,'text-anchor':'end',class:'transfer-axis-label'},`${p*100}%`));
    });
    [0,15,31].forEach(i => chart.append(svg('text',{x:plot.x(i),y:bottom+24,'text-anchor':'middle',class:'transfer-axis-label'},i+1)));
    const defs = svg('defs',{});
    for (const part of ['past','future']) {
      const clip=svg('clipPath',{id:`transfer-${part}-clip`,clipPathUnits:'userSpaceOnUse'});
      const rect=svg('rect',{x:left-3,y:top-3,width:0,height:bottom-top+6});
      if(part==='past')pastClip=rect;else futureClip=rect;
      clip.append(rect);defs.append(clip);
    }
    chart.append(defs);
    data.trajectories.forEach(t => {
      const points=t.frames.map(f=>`${plot.x(f.frame_index)},${plot.y(f.progress)}`).join(' ');
      for(const part of ['past','future'])chart.append(svg('polyline',{points,stroke:t.color,class:`transfer-curve transfer-${part}`,'data-trajectory':t.id,'clip-path':`url(#transfer-${part}-clip)`}));
    });
    cursor=svg('line',{y1:top,y2:bottom,class:'transfer-cursor'});chart.append(cursor);updateCursor();
  }
  function makeCards() {
    get('legend').replaceChildren();get('frames').replaceChildren();images.length=0;
    data.trajectories.forEach(t => {
      const item=document.createElement('span'),swatch=document.createElement('i');swatch.style.background=t.color;swatch.setAttribute('aria-hidden','true');
      item.append(swatch,document.createTextNode(`${t.name} · ${t.role}`));get('legend').append(item);
      const card=document.createElement('div');card.className='transfer-frame-card';
      const heading=document.createElement('div');heading.className='transfer-frame-heading';
      const label=document.createElement('h4');label.textContent=t.name;label.style.color=t.color;
      const role=document.createElement('span');role.className='transfer-role';role.textContent=t.role;
      const stage=document.createElement('div');stage.className='transfer-image-stage';
      const image=document.createElement('img');image.width=320;image.height=256;image.alt='';image.hidden=true;
      images.push(image);stage.append(image);heading.append(label,role);card.append(heading,stage);get('frames').append(card);
    });
  }
  async function tick() {
    if(!playing)return;
    if(currentFrame===lastFrame())return pause();
    const shown=await showFrame(currentFrame+1);
    if(!playing||!shown)return;
    if(currentFrame===lastFrame())return pause();
    timer=setTimeout(tick,250);
  }
  get('previous').addEventListener('click',()=>{const next=requestedFrame-1;pause();showFrame(next);});
  get('next').addEventListener('click',()=>{const next=requestedFrame+1;pause();showFrame(next);});
  get('play').addEventListener('click',async()=>{
    if(playing)return pause();
    pause();playing=true;updateControls();
    if(currentFrame===lastFrame()&&!await showFrame(0))return;
    if(playing)timer=setTimeout(tick,250);
  });
  get('frame-retry').addEventListener('click',()=>{const next=requestedFrame;pause();showFrame(next);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  if('ResizeObserver' in window)new ResizeObserver(drawChart).observe(chart);else window.addEventListener('resize',drawChart);
  async function initialize() {
    if(initialized)return;initialized=true;get('retry').hidden=true;get('loading').textContent='Loading cross-embodiment trajectories…';
    try {
      const response=await fetch(new URL('assets/capabilities/cross-embodiment/index.json?v=20261102-reference',document.baseURI));
      if(!response.ok)throw new Error('Data unavailable');data=await response.json();
      if(data.trajectories?.length!==4||data.trajectories.some(t=>t.frames?.length!==32||t.frames.some((f,i)=>f.frame_index!==i||!Number.isFinite(f.progress)||f.progress<0||f.progress>1)))throw new Error('Invalid trajectories');
      makeCards();browser.hidden=false;get('loading').hidden=true;drawChart();showFrame(0);
    }catch{initialized=false;browser.hidden=true;get('loading').hidden=false;get('loading').textContent='Cross-embodiment trajectories could not be loaded.';get('retry').hidden=false;}
  }
  get('retry').addEventListener('click',initialize);
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();initialize();}},{rootMargin:'400px'});observer.observe(root);}else initialize();
})();
