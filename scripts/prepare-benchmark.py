"""Generate static benchmark figures and table; see README for the pinned plotting command."""
import csv
import html
import hashlib
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
# Configuration names in the exports, followed by the method and its table label.
NAMES = {
    'icl_27b_lora_astralabel_step1500': ('Yuheng 27B', 'Yuheng', '27B', 'ours-27b'),
    'icl_4b_astralabel_step3000': ('Yuheng 4B', 'Yuheng', '4B', 'ours-4b'),
    'official_4b_uniform8_interp32': ('Robometer 4B', 'Robometer', 'Global frame sampling', 'baseline'),
    'official_4b_dense_pred': ('Robometer 4B · Dense Pred', 'Robometer', 'Incremental prefix sampling', 'baseline'),
    'NimCritic': ('NimCritic', 'NimCritic', None, 'baseline'),
    'Flora-Rewarder': ('Flora Rewarder', 'Flora Rewarder', None, 'baseline'),
    'RoboReward-4B': ('RoboReward 4B', 'RoboReward', '4B', 'baseline'),
    'RoboReward-8B': ('RoboReward 8B', 'RoboReward', '8B', 'baseline'),
    'Robo-Dopamine-GRM-2.0-8B-Preview': ('GRM 2.0 Preview 8B', 'GRM 2.0 Preview', '8B', 'baseline'),
    'Robo-Dopamine-GRM-2.0-4B-Preview': ('GRM 2.0 Preview 4B', 'GRM 2.0 Preview', '4B', 'baseline'),
    'densereward-3frame-thinking': ('DenseReward · 3-frame thinking', 'DenseReward', '3-frame thinking', 'baseline'),
    'densereward-1frame': ('DenseReward · single frame', 'DenseReward', 'single frame', 'baseline'),
    'Robo-Dopamine-GRM-8B': ('GRM 8B', 'GRM', '8B', 'baseline'),
    'Robo-Dopamine-GRM-3B': ('GRM 3B', 'GRM', '3B', 'baseline'),
    'RynnValue-8B': ('RynnValue 8B*', 'RynnValue*', '8B', 'baseline'),
    'RynnValue-4B': ('RynnValue 4B*', 'RynnValue*', '4B', 'baseline'),
}
FIELDS = ['within_overall', 'within_success', 'within_non_success',
          'cross_overall', 'cross_success_success', 'cross_non_success_non_success', 'cross_success_non_success',
          'terminal_agreement', 'mae_overall', 'mae_success', 'mae_non_success']
AGREEMENTS = ['within_overall', 'cross_overall', 'terminal_agreement']
COLORS = {'ours-27b': '#ce553b', 'ours-4b': '#ed985e', 'baseline': '#a9b7c3'}
models = []
for original in DATA['models']:
    name, method, config, kind = NAMES[original['model_id']]
    row = {'model': name, 'method': method, 'config': config, 'kind': kind}
    for key in FIELDS:
        value = original[key]
        assert value is None or (math.isfinite(value) and 0 <= value <= 100)
        row[key] = value
    row['average'] = sum(row[key] for key in AGREEMENTS) / 3 if all(row[key] is not None for key in AGREEMENTS) else None
    models.append(row)
assert len(models) == len(NAMES)
assert {m['model_id'] for m in DATA['models']} == set(NAMES)
with (SOURCE / 'complete_metrics_machine.csv').open(encoding='utf-8-sig') as file:
    csv_rows = {row['model_id']: row for row in csv.DictReader(file)}
for original in DATA['models']:
    for key in FIELDS:
        raw = csv_rows[original['model_id']][key]
        value = None if raw in ('', 'NA', 'N/A', 'nan', 'None') else float(raw)
        assert value == original[key], (original['model_id'], key)

# Descending Average score, with unranked N/A models at the bottom.
ordered = sorted(models, key=lambda m: (m['average'] is not None,
                 m['average'] if m['average'] is not None else (m['within_overall']+m['cross_overall'])/2, m['model']), reverse=True)
# The first configuration per method supplies every score in the collapsed row and chart.
methods = {}
for model in ordered:
    methods.setdefault(model['method'], []).append(model)

plt.rcParams.update({
    'font.family': 'DejaVu Sans', 'font.size': 13, 'svg.fonttype': 'path',
    'svg.hashsalt': 'yuheng-ood-20261031', 'axes.spines.top': False,
    'axes.spines.right': False, 'axes.spines.left': False, 'axes.spines.bottom': False,
    'text.color': '#302b2c', 'axes.labelcolor': '#655b5d',
    'xtick.color': '#655b5d', 'ytick.color': '#655b5d',
})
CHARTS = [
    ('average', 'Average score', 'Equal-weight mean of the three overall agreement rates.'),
]
chart_markup = []
for key, title, description in CHARTS:
    ranked = [configs[0] for configs in methods.values() if configs[0][key] is not None]
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
    ax.set_xticks(range(len(ranked)), [m['method'].replace('2.0 Preview', '2.0\nPreview').replace('Flora Rewarder', 'Flora\nRewarder') for m in ranked], fontsize=12.5, linespacing=1.3)
    ax.tick_params(axis='both', length=0, pad=10)
    ax.yaxis.grid(True, color='#e8dfdb', linewidth=.8, zorder=0)
    for bar, model in zip(bars, ranked):
        bar.set_gid('bar-' + re.sub('[^a-z0-9]+', '-', model['method'].lower()).strip('-'))
        ax.text(bar.get_x()+bar.get_width()/2, bar.get_height()+2, f"{model[key]:.1f}",
                ha='center', va='bottom', fontsize=15, color='#302b2c',
                weight='bold' if model['kind'].startswith('ours') else 'normal')
    for label, model in zip(ax.get_xticklabels(), ranked):
        if model['kind'].startswith('ours'):
            label.set_color(COLORS[model['kind']]);label.set_weight('bold')
    output = DEST / f'{key}.svg'
    fig.savefig(output, transparent=True, metadata={'Date': None, 'Title': title,
        'Description': 'Highest configuration Average per method, sorted from highest to lowest. Scores in percent, rounded to one decimal place.'})
    plt.close(fig)
    chart = output.read_text().replace('<svg ', '<svg role="img" aria-label="'+html.escape(title)+'; higher scores are better" ', 1)
    chart = '\n'.join(line.rstrip() for line in chart.splitlines()) + '\n'
    output.write_text(chart)
    chart_version = hashlib.sha256(chart.encode()).hexdigest()[:12]
    missing = ' RynnValue is not included because this metric is not applicable.' if key in ('average','terminal_agreement') else ''
    chart_markup.append(f'''<figure class="result-chart" aria-labelledby="chart-{key}-title">
      <figcaption><h4 id="chart-{key}-title">{title}</h4>
      <div class="results-chart-key" aria-label="Chart colors"><span><i class="key-27b" aria-hidden="true"></i>Yuheng</span><span><i class="key-baseline" aria-hidden="true"></i>Other methods</span></div></figcaption>
      <div class="result-chart-scroll" tabindex="0" role="region" aria-label="{title} chart; scroll horizontally"><img src="assets/benchmark/ood_20261031/{key}.svg?v={chart_version}" width="{chart_width}" height="304" style="min-width: {chart_width}px" loading="lazy" alt="{title}: best configuration per method, sorted from highest to lowest, with scores to one decimal place. Full numerical results are in the table below.{missing}"></div>
    </figure>''')

columns = ['average'] + FIELDS
# Rank distinct full-precision values; missing metrics are never ranked.
ranked_values = {key: sorted({m[key] for m in models if m[key] is not None},
                            reverse=not key.startswith('mae_')) for key in columns}
best = {key: values[0] for key, values in ranked_values.items()}
second = {key: values[1] if len(values) > 1 else None for key, values in ranked_values.items()}
def score_cells(model):
    cells = []
    for key in columns:
        value = model[key]
        if value is None:
            content = '<span class="result-na" aria-label="Not applicable">—</span>'
        else:
            formatted = f'{value:.1f}'
            if value == best[key]:
                content = f'<strong title="Best in this column">{formatted}</strong>'
            elif value == second[key]:
                content = f'<span class="result-second" title="Second-best in this column">{formatted}</span>'
            else:
                content = formatted
        extra = ' result-average' if key == 'average' else ''
        group = key.split('_', 1)[0]
        detail = f' data-result-detail="{group}"' if group in ('within', 'cross', 'mae') and not key.endswith('_overall') else ''
        cells.append(f'<td class="result-number{extra}" data-metric="{key}"{detail}>{content}</td>')
    return ''.join(cells)


rows = []
for method, configs in methods.items():
    # One tbody per method keeps the name beside all configurations when expanded.
    rows.append('<tbody class="result-method">')
    label = html.escape(method)
    if method == 'Yuheng':
        label += ' <span class="result-ours">Ours</span>'
    grouped = len(configs) > 1
    family_cell = f'<th scope="row" colspan="2" class="result-method-name">{label}</th>'
    if grouped:
        toggle = (f'<button type="button" class="result-method-toggle" aria-expanded="true" '
                  f'data-method-name="{html.escape(method, quote=True)}" '
                  f'aria-label="Collapse {html.escape(method, quote=True)} configurations">−</button>')
        family_cell = (f'<th scope="rowgroup" rowspan="{len(configs)}" class="result-method-name">'
                       f'<span class="result-method-label">{label} {toggle}</span></th>')
    for i, model in enumerate(configs):
        config_cell = f'<th scope="row" class="result-config">{html.escape(model["config"])}</th>' if grouped else ''
        rows.append(f'<tr class="{model["kind"]}" data-model="{html.escape(model["model"], quote=True)}">'
                    f'{family_cell if i == 0 else ""}{config_cell}{score_cells(model)}</tr>')
    rows.append('</tbody>')

template = (ROOT / 'scripts' / 'benchmark-section.html').read_text()
markup = template.replace('{{charts}}', '\n'.join(chart_markup)).replace('{{rows}}', '\n'.join(rows)).replace('{{comparison}}', (ROOT / 'scripts/comparison-section.html').read_text())
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
    writer = csv.DictWriter(file, fieldnames=['model']+columns, lineterminator='\n')
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
print(f'Generated {len(CHARTS)} SVG chart, {len(models)} table rows, 12 score columns, and sanitized CSV/JSON exports.')
