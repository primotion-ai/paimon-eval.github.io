"""Export selected method curves, reusing the annotation viewer's PNG assets."""
import csv
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source = json.loads((ROOT / 'benchmark_compare_example/close_drawer.json').read_text())
annotations = json.loads((ROOT / 'assets/annotation-examples/index.json').read_text())
task = next(t for t in annotations['tasks'] if t['id'] == source['task_id'])
# Ordered by the same unrounded Average score as the benchmark bar chart.
selected = [
    ('icl_27b_lora_astralabel_step1500', 'yuheng-27b', 'Yuheng 27B', '#ce553b'),
    ('icl_4b_astralabel_step3000', 'yuheng-4b', 'Yuheng 4B', '#ed985e'),
    ('Flora-Rewarder', 'flora', 'Flora Rewarder', '#318572'),
    ('official_4b_uniform8_interp32', 'robometer', 'Robometer 4B', '#3978b7'),
    ('Robo-Dopamine-GRM-2.0-8B-Preview', 'grm-preview', 'GRM 2.0 Preview 8B', '#8262b0'),
    ('RoboReward-8B', 'roboreward', 'RoboReward 8B', '#ba8b23'),
    ('densereward-3frame-thinking', 'densereward', 'DenseReward · 3-frame thinking', '#bf6293'),
    ('Robo-Dopamine-GRM-8B', 'grm', 'GRM 8B', '#439fae'),
]
scores = json.loads((ROOT / 'assets/benchmark/ood_20261031/results.json').read_text())['models']
averages = {m['model']: m['average'] for m in scores}
assert [averages[m[2]] for m in selected] == sorted((averages[m[2]] for m in selected), reverse=True)
with (ROOT / 'benchmark_compare_example/close_drawer_frames.csv').open(encoding='utf-8-sig') as f:
    csv_rows = {(r['trajectory_id'], int(r['frame_index'])): r for r in csv.DictReader(f)}
trajectories = []
for item in source['trajectories']:
    original = next(t for t in task['trajectories'] if t['id'] == item['trajectory_id'])
    assert item['frame_indices'] == [f['frame_index'] for f in original['frames']]
    assert item['ground_truth_progress'] == [f['progress'] for f in original['frames']]
    assert item['terminal_outcome'] == original['outcome']
    assert item['is_icl_reference'] == original['is_reference']
    curves = {'ground-truth': item['ground_truth_progress']}
    for raw, key, _, _ in selected:
        values = item['predictions'][raw]['progress']
        assert len(values) == len(original['frames']) == 32
        assert all(math.isfinite(v) and 0 <= v <= 1 for v in values)
        for i, v in enumerate(values):
            assert float(csv_rows[(item['trajectory_id'], i)][raw + '__progress']) == v
        curves[key] = values
    for frame in original['frames']:
        assert (ROOT / 'assets/annotation-examples' / frame['image_path']).is_file()
    trajectories.append({**original, 'curves': curves})
assert len(trajectories) == 6
public = {
    'schema_version': 1,
    'models': [{'id': 'ground-truth', 'name': 'Progress ground truth', 'color': '#171717'}] + [
        {'id': key, 'name': name, 'color': color} for _, key, name, color in selected],
    'tasks': [{'id': task['id'], 'instruction': task['instruction'], 'trajectories': trajectories}],
}
dest = ROOT / 'assets/benchmark-comparison'
dest.mkdir(exist_ok=True)
(dest / 'index.json').write_text(json.dumps(public, ensure_ascii=False, separators=(',', ':')) + '\n')
print('Exported 6 trajectories × 32 frames, progress ground truth + 8 models; existing PNGs reused unchanged.')
