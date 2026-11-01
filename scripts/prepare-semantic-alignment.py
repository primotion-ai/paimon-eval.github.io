"""Export shared-reference predictions while reusing checksum-identical public PNGs."""
import csv
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'capabilities/semantic_progress_alignment'
index = json.loads((SOURCE / 'index.json').read_text())
predictions = json.loads((SOURCE / index['predictions_file']).read_text())
for name, digest in index['data_sha256'].items():
    assert hashlib.sha256((SOURCE / name).read_bytes()).hexdigest() == digest
with (SOURCE / index['frame_values_file']).open() as file:
    rows = list(csv.DictReader(file))
existing = json.loads((ROOT / 'assets/annotation-examples/index.json').read_text())
lookup = {t['id']: t for task in existing['tasks'] for t in task['trajectories']}
assert index['model_id'] == predictions['model_id'] == 'icl_27b_lora_astralabel_step1500'
assert index['icl_reference']['trajectory_id'] == predictions['reference_trajectory_id']
assert index['icl_reference']['frame_indices'] == predictions['reference_frame_indices']
assert index['icl_reference']['progress'] == predictions['reference_progress']
assert len(index['trajectories']) == len(predictions['trajectories']) == 2
trajectories = []
for order, trajectory in enumerate(index['trajectories']):
    identity = trajectory['trajectory_id']
    predicted = next(t for t in predictions['trajectories'] if t['trajectory_id'] == identity)
    assert predicted['reference_trajectory_id'] == predictions['reference_trajectory_id']
    assert predicted['frame_indices'] == [f['frame_index'] for f in trajectory['frames']] == list(range(32))
    assert len(predicted['progress']) == len(rows) == 32
    frames = []
    for frame, value in zip(trajectory['frames'], predicted['progress']):
        i = frame['frame_index']
        assert math.isfinite(value) and 0 <= value <= 1
        assert int(rows[i]['frame_index']) == i and float(rows[i][identity + '__progress']) == value
        assert math.isclose(predicted['progress_percent'][i], value * 100, abs_tol=1e-10)
        assert hashlib.sha256((SOURCE / frame['image_path']).read_bytes()).hexdigest() == frame['sha256']
        original = lookup[identity]['frames'][i]
        image_path = 'assets/annotation-examples/' + original['image_path']
        assert original['frame_index'] == i
        assert hashlib.sha256((ROOT / image_path).read_bytes()).hexdigest() == frame['sha256']
        frames.append({'frame_index': i, 'progress': value, 'image_path': image_path})
    trajectories.append({'name': f'Trajectory {order + 1}', 'color': ['#3978b7', '#318572'][order], 'frames': frames})
public = {'schema_version': 1, 'task': index['task'], 'model': 'Yuheng 27B', 'trajectories': trajectories}
dest = ROOT / 'assets/capabilities/semantic-alignment'
dest.mkdir(parents=True, exist_ok=True)
(dest / 'index.json').write_text(json.dumps(public, separators=(',', ':'))+'\n')
print('Verified 64 predictions and image checksums; exported 2 trajectories reusing all 64 public PNGs.')
