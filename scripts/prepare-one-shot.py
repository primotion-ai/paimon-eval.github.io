"""Publish first/last frames and unmodified one-shot model prediction curves."""
import hashlib
import json
import math
from pathlib import Path
import shutil

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'capabilities/one_shot_multi_task'
DEST = ROOT / 'assets/capabilities/one-shot-multi-task'
data = json.loads((SOURCE / 'progress.json').read_text())
assert data['model_id'] == 'icl_27b_lora_astralabel_step1500'
assert 'model predictions' in data['progress_source']
assert len(data['trajectories']) == 3
DEST.mkdir(parents=True, exist_ok=True)
plt.rcParams.update({'svg.fonttype': 'path', 'svg.hashsalt': 'yuheng-one-shot'})
public = {'model': 'Yuheng 27B', 'progress_source': 'Model predictions', 'trajectories': []}
for number, item in enumerate(data['trajectories'], 1):
    indices, values = item['frame_indices'], item['progress']
    assert indices == list(range(32)) and len(values) == 32
    assert all(math.isfinite(value) and 0 <= value <= 1 for value in values)
    images = {}
    for key, frame_index in [('first_frame', 0), ('last_frame', 31)]:
        frame = item[key]
        assert frame['frame_index'] == frame_index and frame['progress'] == values[frame_index]
        source = SOURCE / frame['image_path']
        assert source.parent == SOURCE and source.suffix == '.png'
        assert hashlib.sha256(source.read_bytes()).hexdigest() == frame['sha256']
        name = f'task-{number}-{key.replace("_frame", "")}.png'
        shutil.copyfile(source, DEST / name)
        images[key] = name
    fig, ax = plt.subplots(figsize=(2.2, 1.25), dpi=120)
    fig.patch.set_alpha(0)
    ax.set_facecolor('none')
    fig.subplots_adjust(left=.035, right=.965, bottom=.08, top=.92)
    ax.set_xlim(-.5, 31.5)
    ax.set_ylim(-.035, 1.035)
    ax.set_xticks([])
    ax.set_yticks([])
    for spine in ax.spines.values():
        spine.set_visible(False)
    for value in [0, .5, 1]:
        ax.axhline(value, color='#e7ddd7', linewidth=.8, zorder=1)
    line, = ax.plot(indices, values, color='#c6533b', linewidth=2.2, solid_capstyle='round', zorder=2)
    line.set_gid(f'one-shot-progress-{number}')
    filename = f'task-{number}-progress.svg'
    fig.savefig(DEST / filename, transparent=True, metadata={'Date': None,
        'Title': f'Yuheng 27B predicted progress: {item["task"]}',
        'Description': '32 unmodified model predictions; frame position increases left to right, progress increases upward.'})
    plt.close(fig)
    public['trajectories'].append({'task': item['task'], 'trajectory_id': item['trajectory_id'],
        'is_reference': item['is_benchmark_icl_reference'], 'frame_indices': indices,
        'progress': values, **images, 'plot': filename})
(DEST / 'results.json').write_text(json.dumps(public, indent=2) + '\n')
print('Published 6 checksum-verified frames and 3 independent curves from 96 unchanged model predictions.')
