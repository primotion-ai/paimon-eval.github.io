"""Generate static benchmark figures and table; see README for the pinned plotting command."""
import csv
import html
import json
import math
from pathlib import Path
import re

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'benchmark_results' / 'ood_20261031'
DEST = ROOT / 'assets' / 'benchmark' / 'ood_20261031'
DEST.mkdir(parents=True, exist_ok=True)
DATA = json.loads((SOURCE / 'complete_metrics.json').read_text())
NAMES = {
    'icl_27b_lora_astralabel_step1500': ('Yuheng 27B', 'Yuheng\n27B', 'ours-27b'),
    'icl_4b_astralabel_step3000': ('Yuheng 4B', 'Yuheng\n4B', 'ours-4b'),
    'official_4b_uniform8_interp32': ('Robometer 4B', 'Robometer\n4B', 'baseline'),
    'Flora-Rewarder': ('Flora Rewarder', 'Flora\nRewarder', 'baseline'),
    'RoboReward-4B': ('RoboReward 4B', 'RoboReward\n4B', 'baseline'),
    'RoboReward-8B': ('RoboReward 8B', 'RoboReward\n8B', 'baseline'),
    'Robo-Dopamine-GRM-2.0-8B-Preview': ('GRM 2.0 Preview 8B', 'GRM 2.0\nPreview 8B', 'baseline'),
    'Robo-Dopamine-GRM-2.0-4B-Preview': ('GRM 2.0 Preview 4B', 'GRM 2.0\nPreview 4B', 'baseline'),
    'densereward-3frame-thinking': ('DenseReward · 3-frame thinking', 'DenseReward\n3-frame\nthinking', 'baseline'),
    'densereward-1frame': ('DenseReward · single frame', 'DenseReward\nsingle frame', 'baseline'),
    'Robo-Dopamine-GRM-8B': ('GRM 8B', 'GRM\n8B', 'baseline'),
    'Robo-Dopamine-GRM-3B': ('GRM 3B', 'GRM\n3B', 'baseline'),
    'RynnValue-8B': ('RynnValue 8B*', 'RynnValue\n8B*', 'baseline'),
    'RynnValue-4B': ('RynnValue 4B*', 'RynnValue\n4B*', 'baseline'),
}
FIELDS = ['within_success', 'within_non_success', 'within_overall',
          'cross_success_success', 'cross_non_success_non_success', 'cross_success_non_success', 'cross_overall',
          'terminal_agreement', 'mae_success', 'mae_non_success', 'mae_overall']
AGREEMENTS = ['within_overall', 'cross_overall', 'terminal_agreement']
COLORS = {'ours-27b': '#ce553b', 'ours-4b': '#ed985e', 'baseline': '#a9b7c3'}
models = []
for original in DATA['models']:
    name, chart_label, kind = NAMES[original['model_id']]
    row = {'model': name, 'chart_label': chart_label, 'kind': kind}
    for key in FIELDS:
        value = original[key]
        assert value is None or (math.isfinite(value) and 0 <= value <= 100)
        row[key] = value
    row['average'] = sum(row[key] for key in AGREEMENTS) / 3 if all(row[key] is not None for key in AGREEMENTS) else None
    models.append(row)
assert len(models) == len(NAMES) == 14
with (SOURCE / 'complete_metrics_machine.csv').open(encoding='utf-8-sig') as file:
    csv_rows = {row['model_id']: row for row in csv.DictReader(file)}
for original in DATA['models']:
    for key in FIELDS:
        raw = csv_rows[original['model_id']][key]
        value = None if raw in ('', 'NA', 'N/A', 'nan', 'None') else float(raw)
        assert value == original[key], (original['model_id'], key)

plt.rcParams.update({
    'font.family': 'DejaVu Sans', 'font.size': 13, 'svg.fonttype': 'path',
    'svg.hashsalt': 'yuheng-ood-20261031', 'axes.spines.top': False,
    'axes.spines.right': False, 'axes.spines.left': False, 'axes.spines.bottom': False,
    'text.color': '#302b2c', 'axes.labelcolor': '#655b5d',
    'xtick.color': '#655b5d', 'ytick.color': '#655b5d',
})
CHARTS = [
    ('average', 'Average score', 'Equal-weight mean of the three overall agreement rates.'),
    ('within_overall', 'Within-trajectory agreement', 'Overall pair agreement within individual trajectories.'),
    ('cross_overall', 'Cross-trajectory agreement', 'Overall pair agreement across different trajectories.'),
    ('terminal_agreement', 'Terminal outcome agreement', 'Agreement with the annotated success, suboptimal, or failure outcome.'),
]
chart_markup = []
for key, title, description in CHARTS:
    ranked = sorted((m for m in models if m[key] is not None), key=lambda m: (-m[key], m['model']))
    chart_width = len(ranked) * 116
    fig, ax = plt.subplots(figsize=(chart_width / 80, 3.8), dpi=120)
    fig.subplots_adjust(left=.065, right=.99, top=.96, bottom=.29)
    fig.patch.set_alpha(0)
    ax.set_facecolor('none')
    bars = ax.bar(range(len(ranked)), [m[key] for m in ranked], width=.61,
                  color=[COLORS[m['kind']] for m in ranked], zorder=3)
    ax.set_ylim(0, 105)
    ax.set_xlim(-.65, len(ranked)-.35)
    ax.set_yticks([0, 25, 50, 75, 100], [f'{v}%' for v in [0, 25, 50, 75, 100]], fontsize=12)
    ax.set_xticks(range(len(ranked)), [m['chart_label'] for m in ranked], fontsize=12.5, linespacing=1.3)
    ax.tick_params(axis='both', length=0, pad=10)
    ax.yaxis.grid(True, color='#e8dfdb', linewidth=.8, zorder=0)
    for bar, model in zip(bars, ranked):
        bar.set_gid('bar-' + re.sub('[^a-z0-9]+', '-', model['model'].lower()).strip('-'))
        ax.text(bar.get_x()+bar.get_width()/2, bar.get_height()+2, f"{model[key]:.1f}",
                ha='center', va='bottom', fontsize=15, color='#302b2c',
                weight='bold' if model['kind'].startswith('ours') else 'normal')
    for label, model in zip(ax.get_xticklabels(), ranked):
        if model['kind'].startswith('ours'):
            label.set_color(COLORS[model['kind']]);label.set_weight('bold')
    output = DEST / f'{key}.svg'
    fig.savefig(output, transparent=True, metadata={'Date': None, 'Title': title,
        'Description': 'OOD benchmark. Scores in percent, sorted from highest to lowest. Labels show one decimal place.'})
    plt.close(fig)
    chart = output.read_text().replace('<svg ', '<svg role="img" aria-label="'+html.escape(title)+'; higher scores are better" ', 1)
    output.write_text(chart)
    missing = ' RynnValue is not included because this metric is not applicable.' if key in ('average','terminal_agreement') else ''
    chart_markup.append(f'''<figure class="result-chart" aria-labelledby="chart-{key}-title">
      <figcaption><div><h4 id="chart-{key}-title">{title}</h4><p>{description}</p></div><span class="result-direction">Higher is better ↑</span></figcaption>
      <div class="result-chart-scroll" tabindex="0" role="region" aria-label="{title} chart; scroll horizontally"><img src="assets/benchmark/ood_20261031/{key}.svg" width="{chart_width}" height="304" style="min-width: {chart_width}px" loading="lazy" alt="{title}: models sorted from highest to lowest, with scores to one decimal place. Full numerical results are in the table below.{missing}"></div>
    </figure>''')

# N/A models are unranked at the top; comparable rows then increase in Average score.
ordered = sorted(models, key=lambda m: (m['average'] is not None,
                 m['average'] if m['average'] is not None else (m['within_overall']+m['cross_overall'])/2, m['model']))
columns = ['average'] + FIELDS
best = {key: (min if key.startswith('mae_') else max)(m[key] for m in models if m[key] is not None) for key in columns}
rows = []
for model in ordered:
    label = html.escape(model['model']) + (' <span class="result-ours">Ours</span>' if model['kind'].startswith('ours') else '')
    cells = []
    for key in columns:
        value = model[key]
        if value is None:
            content = '<span class="result-na" aria-label="Not applicable">—</span>'
        else:
            formatted = f'{value:.1f}'
            content = f'<strong title="Best in this column">{formatted}</strong>' if value == best[key] else formatted
        extra = ' result-average' if key == 'average' else ''
        cells.append(f'<td class="result-number{extra}" data-metric="{key}">{content}</td>')
    rows.append(f'<tr class="{model["kind"]}" data-model="{html.escape(model["model"], quote=True)}"><th scope="row">{label}</th>{"".join(cells)}</tr>')

template = (ROOT / 'scripts' / 'benchmark-section.html').read_text()
markup = template.replace('{{charts}}', '\n'.join(chart_markup)).replace('{{rows}}', '\n'.join(rows))
page_path = ROOT / 'index.html'
page = page_path.read_text()
if '<!-- BENCHMARK RESULTS START -->' in page:
    page, count = re.subn(r'<!-- BENCHMARK RESULTS START -->.*?<!-- BENCHMARK RESULTS END -->\n?', lambda _: markup, page, flags=re.S)
    assert count == 1
else:
    start = page.index('      <div class="benchmark-panel">')
    end = page.index('</section>', start) + len('</section>')
    page = page[:start] + '      ' + markup + '\n    </section>' + page[end:]
page_path.write_text(page)
with (DEST / 'results.csv').open('w', newline='') as file:
    writer = csv.DictWriter(file, fieldnames=['model']+columns)
    writer.writeheader()
    for model in ordered: writer.writerow({key: model[key] for key in ['model']+columns})
public = {
    'benchmark': 'OOD 2026-10-31', 'tasks': 40, 'trajectories': 502, 'frames': 16064,
    'within_pairs': 16064, 'cross_pairs': 10752,
    'non_success': 'Suboptimal and failed trajectories',
    'average_formula': '(within_overall + cross_overall + terminal_agreement) / 3; null if any component is missing',
    'models': [{key: model[key] for key in ['model']+columns} for model in ordered],
}
(DEST / 'results.json').write_text(json.dumps(public, ensure_ascii=False, indent=2)+'\n')
print(f'Generated 4 SVG charts, {len(models)} table rows, 12 score columns, and sanitized CSV/JSON exports.')
