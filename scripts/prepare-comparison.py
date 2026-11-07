"""Export six-method comparisons and their own verified, original PNG frames."""
import csv
import hashlib
import json
import math
import shutil
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'benchmark_compare_example'
DEST = ROOT / 'assets/benchmark-comparison'
manifest = json.loads((SOURCE / 'manifest.json').read_text())
selected = [
    ('icl_27b_lora_astralabel_step1500', 'yuheng-27b', 'Yuheng 27B', '#ce553b'),
    ('flora_rewarder', 'flora', 'Flora Rewarder', '#318572'),
    ('robometer_4b_uniform8_interp32', 'robometer', 'Robometer 4B', '#3978b7'),
    ('roboreward_4b', 'roboreward', 'RoboReward 4B', '#ba8b23'),
    ('grm_2_0_preview_8b', 'grm-preview', 'GRM 2.0 Preview 8B', '#8262b0'),
    ('nimcritic', 'nimcritic', 'NimCritic', '#439fae'),
]
assert {m['model_id'] for m in manifest['models']} == {m[0] for m in selected}
scores = json.loads((ROOT / 'assets/benchmark/ood_20261031/results.json').read_text())['models']
averages = {m['model']: m['average'] for m in scores}
selected.sort(key=lambda m: averages[m[2]], reverse=True)
checksums = {path: checksum for checksum, path in
             (line.split('  ', 1) for line in (SOURCE / 'checksums.sha256').read_text().splitlines())}
with (SOURCE / 'progress.csv').open(encoding='utf-8-sig') as file:
    rows = {(r['task_id'], r['trajectory_id'], int(r['frame_index'])): r for r in csv.DictReader(file)}

tasks, copies = [], []
for entry in manifest['tasks']:
    task = json.loads((SOURCE / entry['task_path']).read_text())
    trajectories = []
    for identity in task['trajectory_ids']:
        directory = SOURCE / Path(entry['task_path']).parent / 'trajectories' / identity
        progress = json.loads((directory / 'progress.json').read_text())
        target = json.loads((directory / 'astra_target.json').read_text())
        predictions = json.loads((directory / 'model_predictions.json').read_text())
        indices = progress['frame_indices']
        assert progress['task_id'] == task['task_id'] and progress['trajectory_id'] == identity
        assert indices == list(range(len(indices))) and len(indices) > 1
        assert target['progress'] == progress['astra_progress']
        curves = {'ground-truth': progress['astra_progress']}
        for raw, key, _, _ in selected:
            values = progress['model_progress'][raw]
            assert values == predictions[raw]['progress']
            curves[key] = values
        assert all(len(v) == len(indices) and all(math.isfinite(x) and 0 <= x <= 1 for x in v)
                   for v in curves.values())
        frames = []
        dimensions = set()
        for i, relative in zip(indices, progress['image_paths'], strict=True):
            row = rows[(task['task_id'], identity, i)]
            assert row['image_path'] == relative
            assert float(row['astra_progress']) == curves['ground-truth'][i]
            assert all(float(row[raw]) == curves[key][i] for raw, key, _, _ in selected)
            original = SOURCE / relative
            content = original.read_bytes()
            assert hashlib.sha256(content).hexdigest() == checksums[relative]
            assert content[:8] == b'\x89PNG\r\n\x1a\n'
            dimensions.add(struct.unpack('>II', content[16:24]))
            assert not Path(relative).is_absolute() and '..' not in Path(relative).parts
            copies.append((original, DEST / relative))
            frames.append({'frame_index': i, 'progress': curves['ground-truth'][i], 'image_path': relative})
        assert len(dimensions) == 1
        width, height = dimensions.pop()
        trajectories.append({'id': identity, 'outcome': target['terminal_outcome'],
                             'is_reference': identity == task['icl_reference']['trajectory_id'],
                             'width': width, 'height': height, 'frames': frames, 'curves': curves})
    assert len(trajectories) == entry['trajectory_count']
    tasks.append({'id': task['task_id'], 'instruction': task['instruction'], 'trajectories': trajectories})
assert len(tasks) == manifest['task_count']
assert sum(len(t['trajectories']) for t in tasks) == manifest['trajectory_count']
assert len(copies) == len(rows) == manifest['frame_count']
# Validate every input before updating any public resources. Copy only presentation data.
for original, destination in copies:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(original, destination)
public = {'schema_version': 2, 'models': [{'id': key, 'name': name, 'color': color} for _, key, name, color in selected],
          'tasks': tasks}
(DEST / 'index.json').write_text(json.dumps(public, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'Exported {len(tasks)} tasks, {manifest["trajectory_count"]} trajectories, {len(copies)} verified original PNGs; Astra truth + six unmodified model curves.')
