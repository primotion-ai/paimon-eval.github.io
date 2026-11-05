"""Export model progress and PNGs for four bottle-opening alignment examples."""
import csv
import hashlib
import json
import math
from pathlib import Path
import shutil
import struct

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'capabilities/semantic_progress_alignment/open_the_bottle'
DEST = ROOT / 'assets/capabilities/semantic-alignment'
manifest = json.loads((SOURCE / 'manifest.json').read_text())
assert manifest['instruction'] == 'Open the bottle'
assert manifest['model']['model_id'] == 'icl_27b_lora_astralabel_step1500'
assert manifest['total_trajectories'] == len(manifest['trajectories']) == 4
assert manifest['total_frames'] == 128
assert [t['source_quality'] for t in manifest['trajectories']] == ['successful', 'successful', 'failure', 'failure']
for line in (SOURCE / 'checksums.sha256').read_text().splitlines():
    digest, name = line.split(maxsplit=1)
    file = SOURCE / name
    assert file.resolve().is_relative_to(SOURCE.resolve())
    assert hashlib.sha256(file.read_bytes()).hexdigest() == digest, name
with (SOURCE / 'progress.csv').open() as file:
    csv_rows = list(csv.DictReader(file))
lookup = {(r['trajectory_id'], int(r['frame_index'])): r for r in csv_rows}
assert len(lookup) == len(csv_rows) == 128
colors = ['#3978b7', '#318572', '#d18839', '#cd555b']
trajectories = []
for order, source in enumerate(manifest['trajectories']):
    identity = source['trajectory_id']
    predicted = json.loads((SOURCE / source['model_prediction_path']).read_text())
    progress = json.loads((SOURCE / source['progress_path']).read_text())
    assert predicted['benchmark_id'] == manifest['benchmark_id']
    assert predicted['trajectory_id'] == progress['trajectory_id'] == identity
    assert progress['model_id'] == manifest['model']['model_id']
    assert predicted['frame_indices'] == progress['frame_indices'] == [f['frame_index'] for f in source['frames']] == list(range(32))
    assert len(predicted['progress']) == len(progress['model_progress']) == 32
    frames = []
    dimensions = None
    for i, frame in enumerate(source['frames']):
        value = frame['model_progress']
        assert math.isfinite(value) and 0 <= value <= 1
        assert value == predicted['progress'][i] == progress['model_progress'][i] == progress['frames'][i]['model_progress'] == float(lookup[(identity, i)]['model_progress'])
        assert frame['image_path'] == progress['frames'][i]['image_path'] == lookup[(identity, i)]['image_path']
        assert lookup[(identity, i)]['source_quality'] == source['source_quality']
        image = SOURCE / frame['image_path']
        raw = image.read_bytes()
        assert raw[:8] == b'\x89PNG\r\n\x1a\n'
        size = struct.unpack('>II', raw[16:24])
        if dimensions is None:
            dimensions = size
        assert size == dimensions
        output = DEST / 'images' / identity / f'{i:04d}.png'
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(image, output)
        frames.append({'frame_index': i, 'progress': value, 'image_path': str(output.relative_to(ROOT))})
    trajectories.append({'id': identity, 'name': f'Trajectory {order + 1}',
        'outcome': {'successful': 'success', 'suboptimal': 'suboptimal', 'failure': 'failure'}[source['source_quality']],
        'is_reference': source['is_icl_reference'], 'color': colors[order],
        'width': dimensions[0], 'height': dimensions[1], 'frames': frames})
public = {'schema_version': 2, 'task': manifest['instruction'], 'model': 'Yuheng 27B',
          'outcome_source': 'original source_quality_label', 'trajectories': trajectories}
DEST.mkdir(parents=True, exist_ok=True)
(DEST / 'index.json').write_text(json.dumps(public, separators=(',', ':')) + '\n')
print('Verified all source checksums and 128 model predictions against CSV/JSON; exported four trajectories and 128 PNGs. No NPZ or annotation files exported.')
