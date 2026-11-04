// The reference scale defines the progress assigned to each illustrated semantic stage.
const explorer = document.querySelector('#scale-explorer');
const milestone = document.querySelector('#milestone');
const milestoneName = document.querySelector('#milestone-name');
const alignedProgress = document.querySelector('#aligned-progress');
const stages = ['Start', 'Grasp', 'Move', 'Finish(Place)'];
const scales = { uniform: [0, 33, 67, 100], custom: [0, 20, 85, 100] };
const stageImages = ['start', 'grasp', 'move', 'finish'].map(name => `assets/scale-explorer/${name}.png`);
const stageDescriptions = ['robot before approaching the object', 'robot grasping the object', 'robot moving the object', 'robot placing the object'];
const explorerImage = document.querySelector('#explorer-image');
const explorerChart = document.querySelector('#explorer-progress-chart');
const explorerFrame = document.querySelector('#explorer-frame');
const imageError = document.querySelector('#explorer-image-error');
let displayedStage = -1, imageRequest = 0;
const stageImageCache = new Map();

function loadStageImage(stage) {
  if (!stageImageCache.has(stage)) {
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => image.decode().then(() => resolve(image), reject);
      image.onerror = () => reject(new Error('Stage image unavailable'));
      image.src = new URL(stageImages[stage], document.baseURI).href;
    });
    stageImageCache.set(stage, promise);
    promise.catch(() => { if (stageImageCache.get(stage) === promise) stageImageCache.delete(stage); });
  }
  return stageImageCache.get(stage);
}

async function showStageImage(stage) {
  const request = ++imageRequest;
  displayedStage = stage;
  explorerFrame.setAttribute('aria-busy', 'true');
  explorerImage.hidden = true;
  imageError.hidden = true;
  try {
    const image = await loadStageImage(stage);
    if (request !== imageRequest) return;
    explorerImage.src = image.src;
    explorerImage.alt = `${stages[stage]} — ${stageDescriptions[stage]}`;
    explorerImage.hidden = false;
    explorerFrame.setAttribute('aria-busy', 'false');
  } catch {
    if (request !== imageRequest) return;
    explorerFrame.setAttribute('aria-busy', 'false');
    imageError.hidden = false;
  }
}

function explorerSvg(name, attributes, text) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  if (text !== undefined) element.textContent = text;
  return element;
}

function drawReferenceChart() {
  if (!explorerChart || explorer.hidden) return;
  const width = explorerChart.clientWidth, height = explorerChart.clientHeight;
  if (!width || !height) return;
  const selectedScale = explorer.querySelector('input[name="scale"]:checked').value;
  const values = scales[selectedScale], stage = Number(milestone.value);
  const left = 48, right = width - 12, top = 12, bottom = height - 16;
  const x = index => left + (right - left) * index / 3;
  const y = value => bottom - (bottom - top) * value / 100;
  explorerChart.setAttribute('viewBox', `0 0 ${width} ${height}`);
  explorerChart.querySelectorAll(':scope > :not(title):not(desc)').forEach(node => node.remove());
  [0, 25, 50, 75, 100].forEach(value => {
    explorerChart.append(explorerSvg('line', {x1:left, x2:right, y1:y(value), y2:y(value), class:'explorer-gridline'}));
    explorerChart.append(explorerSvg('text', {x:left - 8, y:y(value) + 5, 'text-anchor':'end', class:'explorer-axis-label'}, `${value}%`));
  });
  values.forEach((_, index) => explorerChart.append(explorerSvg('line', {x1:x(index), x2:x(index), y1:bottom, y2:bottom + 5, class:'explorer-gridline'})));
  explorerChart.append(explorerSvg('polyline', {points:values.map((value,index) => `${x(index)},${y(value)}`).join(' '), class:'explorer-progress-line'}));
  values.forEach((value,index) => explorerChart.append(explorerSvg('circle', {
    cx:x(index), cy:y(value), r:index === stage ? 6 : 3.5,
    class:`explorer-progress-point${index === stage ? ' is-current' : ''}`,
    'data-stage':index, 'data-progress':value,
  })));
  document.querySelector('#explorer-chart-description').textContent = `Four evenly spaced time points: ${values.map((value,index) => `${stages[index]} ${value}%`).join(', ')}. Highlighted: ${stages[stage]}, ${values[stage]}%.`;
}

function updateIllustration() {
  const selectedScale = explorer.querySelector('input[name="scale"]:checked').value;
  const stage = Number(milestone.value);
  milestoneName.value = stages[stage];
  alignedProgress.value = `${scales[selectedScale][stage]}%`;
  milestone.setAttribute('aria-valuetext', `${stages[stage]}, reference progress ${scales[selectedScale][stage]} percent`);
  drawReferenceChart();
  if (displayedStage !== stage) showStageImage(stage);
}
if (explorer && milestone) {
  explorer.hidden = false;
  milestone.addEventListener('input', updateIllustration);
  explorer.querySelectorAll('input[name="scale"]').forEach(input => input.addEventListener('change', updateIllustration));
  document.querySelector('#explorer-image-retry').addEventListener('click', () => showStageImage(Number(milestone.value)));
  if ('ResizeObserver' in window) new ResizeObserver(drawReferenceChart).observe(explorerChart);
  else window.addEventListener('resize', drawReferenceChart);
  updateIllustration();
  // Four small PNGs keep subsequent dragging immediate without duplicating source assets.
  stages.forEach((_, index) => { loadStageImage(index).catch(() => {}); });
}

// Keep each benchmark group's Overall score visible while revealing its breakdown to the right.
(() => {
  const table = document.querySelector('.results-table');
  if (!table) return;
  const names = { within: 'within-trajectory', cross: 'cross-trajectory', mae: 'MAE' };
  table.querySelectorAll('[data-result-toggle]').forEach(button => {
    const group = button.dataset.resultToggle;
    const heading = table.querySelector(`[data-result-group="${group}"]`);
    const details = [...table.querySelectorAll(`[data-result-detail="${group}"]`)];
    const expandedSpan = heading.colSpan;
    function setExpanded(expanded) {
      details.forEach(cell => { cell.hidden = !expanded; });
      heading.colSpan = expanded ? expandedSpan : 1;
      button.setAttribute('aria-expanded', String(expanded));
      button.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} ${names[group]} breakdown; Overall remains visible`);
      button.title = `${expanded ? 'Hide' : 'Show'} ${names[group]} breakdown`;
      button.querySelector('span').textContent = expanded ? '−' : '+';
    }
    button.addEventListener('click', () => setExpanded(button.getAttribute('aria-expanded') !== 'true'));
    setExpanded(false);
  });
})();
