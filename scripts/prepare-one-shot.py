"""Export 25 PNG sequences and their unchanged model progress for the radial demo."""
import csv
import hashlib
import json
import math
from pathlib import Path
import shutil
import struct

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'one_shot_multi_task'
DEST = ROOT / 'assets/capabilities/one-shot-multi-task'
manifest = json.loads((SOURCE / 'manifest.json').read_text())
assert manifest['model']['model_id'] == 'icl_27b_lora_astralabel_step1500'
assert manifest['total_trajectories'] == len(manifest['samples']) == 25
assert manifest['total_query_frames'] == 800
for line in (SOURCE / 'checksums.sha256').read_text().splitlines():
    digest, name = line.split(maxsplit=1)
    file = SOURCE / name
    assert file.resolve().is_relative_to(SOURCE.resolve())
    assert hashlib.sha256(file.read_bytes()).hexdigest() == digest, name
with (SOURCE / 'progress.csv').open() as file:
    rows = list(csv.DictReader(file))
lookup = {(r['trajectory_id'], int(r['frame_index'])): r for r in rows}
assert len(rows) == len(lookup) == 800
public = {'schema_version': 2, 'model': 'Yuheng 27B', 'progress_source': 'Model predictions',
          'task_count': manifest['total_tasks'], 'trajectories': []}
for number, sample in enumerate(manifest['samples'], 1):
    identity = sample['trajectory_id']
    assert sample['astra_outcome'] in ['success', 'failure']
    assert sample['category'] == ('success' if sample['astra_outcome'] == 'success' else 'non_success')
    progress = json.loads((SOURCE / sample['progress_path']).read_text())
    predicted = json.loads((SOURCE / sample['model_prediction_path']).read_text())
    assert predicted['trajectory_id'] == progress['trajectory_id'] == identity
    assert predicted['benchmark_id'] == manifest['benchmark_id']
    assert progress['model_id'] == manifest['model']['model_id']
    assert progress['frame_indices'] == predicted['frame_indices'] == list(range(32))
    assert len(sample['frames']) == sample['num_frames'] == 32
    frames = []
    for index, frame in enumerate(sample['frames']):
        row = lookup[identity, index]
        value = frame['model_progress']
        assert frame['frame_index'] == index
        assert value == predicted['progress'][index] == progress['model_progress'][index] == progress['frames'][index]['model_progress'] == float(row['model_progress'])
        assert math.isfinite(value) and 0 <= value <= 1
        assert frame['image_path'] == progress['frames'][index]['image_path'] == row['image_path']
        image = SOURCE / frame['image_path']
        assert image.resolve().is_relative_to(SOURCE.resolve())
        content = image.read_bytes()
        assert content[:8] == b'\x89PNG\r\n\x1a\n'
        assert struct.unpack('>II', content[16:24]) == (frame['width'], frame['height']) == (160, 120)
        output = DEST / 'images' / f'{number:02d}' / f'{index:04d}.png'
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(image, output)
        frames.append({'frame_index': index, 'progress': value, 'image_path': str(output.relative_to(ROOT))})
    public['trajectories'].append({'id': identity, 'task': sample['instruction'], 'task_id': sample['task_id'],
        'width': 160, 'height': 120, 'outcome': sample['astra_outcome'], 'is_reference': sample['is_icl_reference'], 'frames': frames})
assert len({t['task_id'] for t in public['trajectories']}) == public['task_count']
(DEST / 'index.json').write_text(json.dumps(public, separators=(',', ':')) + '\n')
print('Verified source checksums and 800 predictions against CSV/JSON; exported 25 PNG sequences.')
