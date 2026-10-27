// This is a semantic-alignment illustration, not a model prediction.
const explorer = document.querySelector('#scale-explorer');
const milestone = document.querySelector('#milestone');
const milestoneName = document.querySelector('#milestone-name');
const alignedProgress = document.querySelector('#aligned-progress');
const stages = ['Task start', 'Object grasped', 'Object placed', 'Task complete'];
const scales = { uniform: [0, 33, 67, 100], custom: [0, 20, 85, 100] };
function updateIllustration() {
  const selectedScale = document.querySelector('input[name="scale"]:checked').value;
  const stage = Number(milestone.value);
  milestoneName.value = stages[stage];
  alignedProgress.value = `${scales[selectedScale][stage]}%`;
  milestone.setAttribute('aria-valuetext', `${stages[stage]}, reference progress ${scales[selectedScale][stage]} percent`);
}
if (explorer && milestone) {
  explorer.hidden = false;
  milestone.addEventListener('input', updateIllustration);
  document.querySelectorAll('input[name="scale"]').forEach(input => input.addEventListener('change', updateIllustration));
  updateIllustration();
}
