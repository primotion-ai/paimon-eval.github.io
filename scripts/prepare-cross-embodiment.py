"""Publish four cross-embodiment trajectories with verified original frames and predictions."""
import csv
import hashlib
import json
import math
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'capabilities/cross_embodiment_transfer'
DEST = ROOT / 'assets/capabilities/cross-embodiment'
index = json.loads((SOURCE / 'index.json').read_text())
predictions = json.loads((SOURCE / 'predictions.json').read_text())
for name, digest in index['data_sha256'].items():
    assert hashlib.sha256((SOURCE / name).read_bytes()).hexdigest() == digest
with (SOURCE / 'frame_values.csv').open() as file:
    rows = {(r['trajectory_id'], int(r['frame_index'])): r for r in csv.DictReader(file)}
assert len(rows) == 128
assert index['model_id'] == predictions['model_id'] == 'icl_27b_lora_astralabel_step1500'
assert predictions['reference_trajectory_id'] == index['icl_reference']['trajectory_id'] == '1'
assert predictions['reference_frame_indices'] == index['icl_reference']['frame_indices']
assert predictions['reference_progress'] == index['icl_reference']['progress']
assert [t['trajectory_id'] for t in index['trajectories']] == ['1','3','5','7']
labels = [('Human hand', 'reference', '#d48a24'), ('YAM arm', 'Success', '#3978b7'),
          ('Wuji hand', 'Success', '#318572'), ('Wuji hand', 'Failure', '#cd555b')]
trajectories = []
for source, (name, role, color) in zip(index['trajectories'], labels):
    identity = source['trajectory_id']
    predicted = next(t for t in predictions['trajectories'] if t['trajectory_id'] == identity)
    assert predicted['reference_trajectory_id'] == '1'
    assert len(predicted['progress']) == source['num_frames'] == 32
    assert predicted['frame_indices'] == [f['frame_index'] for f in source['frames']] == list(range(32))
    frames = []
    for frame, value in zip(source['frames'], predicted['progress']):
        i = frame['frame_index']; row = rows[(identity, i)]
        assert math.isfinite(value) and 0 <= value <= 1
        assert float(row['progress']) == value and row['image_path'] == frame['image_path']
        assert math.isclose(predicted['progress_percent'][i], value * 100, abs_tol=1e-10)
        image = SOURCE / frame['image_path']
        assert hashlib.sha256(image.read_bytes()).hexdigest() == frame['sha256']
        output = DEST / 'images' / identity / f'{i:04}.png'
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(image, output)
        frames.append({'frame_index': i, 'progress': value, 'image_path': str(output.relative_to(ROOT))})
    trajectories.append({'id': identity, 'name': name, 'role': role, 'color': color, 'frames': frames})
(DEST / 'index.json').write_text(json.dumps({'task': index['task'], 'model': 'Yuheng 27B', 'reference': {key: index['icl_reference'][key] for key in ['trajectory_id', 'frame_indices', 'progress']}, 'trajectories': trajectories}, separators=(',', ':'))+'\n')
print('Verified 128 predictions against CSV and all frame checksums; exported four trajectories with the reference keyframes and progress scale.')
