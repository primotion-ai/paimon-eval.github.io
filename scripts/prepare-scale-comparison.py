"""Publish the two reference-scale experiments without altering their predictions."""
import csv
import hashlib
import json
import math
from pathlib import Path
import shutil

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'capabilities/different_progress_scale'
DEST = ROOT / 'assets/capabilities/different-progress-scale'
DEST.mkdir(parents=True, exist_ok=True)
metadata = json.loads((SOURCE / 'index.json').read_text())
predictions = json.loads((SOURCE / 'predictions.json').read_text())
with (SOURCE / 'frame_values.csv').open() as file:
    rows = list(csv.DictReader(file))
assert metadata['trajectory_id'] == predictions['trajectory_id']
assert metadata['model_id'] == predictions['model_id'] == 'icl_27b_lora_astralabel_step1500'
assert metadata['query_frame_indices'] == list(range(32))
assert len(rows) == 32
assert [c['condition'] for c in predictions['conditions']] == ['anchor20', 'anchor60']
curves = []
for condition, label, color, marker in zip(predictions['conditions'], [[0, .2, 1], [0, .6, 1]], ['#c6533b', '#3978b7'], ['o', 'D']):
    name = condition['condition']
    assert condition['frame_indices'] == list(range(32))
    assert condition['reference_frame_indices'] == [0, 17, 31]
    assert condition['reference_progress'] == label
    meta = next(c for c in metadata['conditions'] if c['condition'] == name)
    assert meta['reference_progress'] == label
    values = condition['progress']
    assert len(values) == 32 and all(math.isfinite(v) and 0 <= v <= 1 for v in values)
    for i, value in enumerate(values):
        assert int(rows[i]['frame_index']) == i
        assert float(rows[i][name + '_progress']) == value
        assert math.isclose(condition['progress_percent'][i], 100 * value, abs_tol=1e-10)
    curves.append({'reference_progress': label, 'progress': values, 'color': color, 'marker': marker})
assert [image['frame_index'] for image in metadata['reference_images']] == [0, 17, 31]
for image in metadata['reference_images']:
    source = SOURCE / image['file']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == image['sha256']
    shutil.copyfile(source, DEST / image['file'])

plt.rcParams.update({'font.family': 'DejaVu Sans', 'svg.fonttype': 'path',
    'svg.hashsalt': 'yuheng-scale-comparison', 'axes.spines.top': False,
    'axes.spines.right': False, 'axes.spines.left': False, 'axes.spines.bottom': False,
    'xtick.color': '#6f6460', 'ytick.color': '#6f6460', 'axes.labelcolor': '#6f6460'})
for compact in [False, True]:
    fig, ax = plt.subplots(figsize=(4 if compact else 6.6, 4.1), dpi=120)
    fig.patch.set_alpha(0); ax.set_facecolor('none')
    fig.subplots_adjust(left=.2 if compact else .14, right=.96, bottom=.18, top=.94)
    ax.set_xlim(-.8, 31.8); ax.set_ylim(-.025, 1.025)
    ax.set_yticks([0,.25,.5,.75,1], ['0%','25%','50%','75%','100%'], fontsize=13)
    ticks = [0,17,31] if compact else [0,8,17,24,31]
    ax.set_xticks(ticks, [str(tick) for tick in ticks], fontsize=13)
    ax.set_xlabel('Frame index', fontsize=13, labelpad=10)
    ax.tick_params(axis='both', length=0, pad=8)
    ax.yaxis.grid(True, color='#e7ddd7', linewidth=.8)
    for frame in [0,17,31]:
        ax.axvline(frame, color='#ded1ca', linewidth=.8, linestyle=(0,(2,4)), zorder=1)
    for i, curve in enumerate(curves):
        line, = ax.plot(range(32), curve['progress'], color=curve['color'], linewidth=2.2, zorder=3)
        line.set_gid(f'scale-curve-{i}')
        markers, = ax.plot([0,17,31], [curve['progress'][j] for j in [0,17,31]], linestyle='none',
            marker=curve['marker'], markersize=6.5, markerfacecolor='white', markeredgecolor=curve['color'], markeredgewidth=1.8, zorder=4+i)
        markers.set_gid(f'reference-frame-markers-{i}')
    name = 'progress-compact.svg' if compact else 'progress.svg'
    fig.savefig(DEST / name, transparent=True, metadata={'Date': None,
        'Title': 'Yuheng 27B progress under two reference scales',
        'Description': 'Close the drawer. Reference labels: 0%, 20%, 100% and 0%, 60%, 100%. Markers show model predictions at reference frame indices 0, 17, 31.'})
    plt.close(fig)
# Match the query sequence by identity, not the viewer's displayed ordinal.
annotations = json.loads((ROOT / 'assets/annotation-examples/index.json').read_text())
trajectory = next(t for task in annotations['tasks'] for t in task['trajectories']
                  if t['id'] == metadata['trajectory_id'])
assert [f['frame_index'] for f in trajectory['frames']] == metadata['query_frame_indices']
(DEST / 'trajectory').mkdir(exist_ok=True)
(SOURCE / 'trajectory').mkdir(exist_ok=True)
frames = []
for frame in trajectory['frames']:
    original = ROOT / 'assets/annotation-examples' / frame['image_path']
    filename = f"{frame['frame_index']:04d}.png"
    shutil.copyfile(original, SOURCE / 'trajectory' / filename)
    shutil.copyfile(original, DEST / 'trajectory' / filename)
    frames.append({'frame_index': frame['frame_index'], 'image_path': f'trajectory/{filename}'})
for reference in metadata['reference_images']:
    image = DEST / frames[reference['frame_index']]['image_path']
    assert hashlib.sha256(image.read_bytes()).hexdigest() == reference['sha256']
public = {'task': metadata['task'], 'model': 'Yuheng 27B', 'frame_indices': list(range(32)),
          'trajectory_id': metadata['trajectory_id'], 'frames': frames,
          'reference_frame_indices': [0,17,31], 'curves': [{k:v for k,v in c.items() if k not in ['color','marker']} for c in curves]}
(DEST / 'results.json').write_text(json.dumps(public, indent=2)+'\n')
print('Verified 64 predictions against CSV, copied 3 checksum-verified images, copied the matching 32-frame query sequence, generated SVG plots and curated data.')
