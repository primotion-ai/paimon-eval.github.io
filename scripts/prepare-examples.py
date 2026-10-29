"""Export only the PNGs and progress fields used by the public trajectory viewer."""
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'bench_example'
DESTINATION = ROOT / 'assets' / 'annotation-examples'
manifest = json.loads((SOURCE / 'manifest.json').read_text())
export = {'schema_version': 1, 'tasks': []}
image_count = 0
for task in manifest['tasks']:
    entry = {'id': task['task_id'], 'instruction': task['instruction'], 'trajectories': []}
    for trajectory in task['trajectories']:
        progress = json.loads((SOURCE / trajectory['progress_path']).read_text())
        frames = []
        for index, frame in enumerate(progress['frames']):
            assert frame['frame_index'] == index
            assert frame['progress'] == progress['progress'][index]
            assert 0 <= frame['progress'] <= 1
            relative = Path(frame['image_path'])
            source = (SOURCE / relative).resolve()
            assert source.is_relative_to(SOURCE.resolve()) and source.suffix == '.png'
            destination = DESTINATION / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, destination)
            frames.append({'frame_index': index, 'image_path': relative.as_posix(), 'progress': frame['progress']})
            image_count += 1
        entry['trajectories'].append({
            'id': trajectory['trajectory_id'],
            'outcome': trajectory['astra_outcome'],
            'is_reference': trajectory['is_icl_reference'],
            'frames': frames,
        })
    export['tasks'].append(entry)
DESTINATION.mkdir(parents=True, exist_ok=True)
(DESTINATION / 'index.json').write_text(json.dumps(export, separators=(',', ':'), ensure_ascii=False) + '\n')
print(f'Exported {len(export["tasks"])} tasks, {image_count} PNGs; no source events, NPZs or provenance.')
