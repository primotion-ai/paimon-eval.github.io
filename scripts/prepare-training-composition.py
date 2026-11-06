"""Render the supplied training mixture without exposing exact counts in the page."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/training-data'
DEST.mkdir(parents=True, exist_ok=True)
sources = [
    ('Galaxea Open World Dataset', 7574, '#be6554'),
    ('RH20T', 4873, '#719991'),
    ('LIBERO', 2260, '#dea86b'),
    ('RoboArena', 745, '#7f92b0'),
    ('AutoEval', 400, '#b690ad'),
    ('Fino Net', 225, '#a3ad79'),
    ('MetaWorld', 144, '#d39b91'),
    ('AgiBotWorld', 100, '#858178'),
]
total = sum(n for _, n, _ in sources)
plt.rcParams.update({'svg.fonttype': 'path', 'svg.hashsalt': 'yuheng-training-data', 'font.family': 'DejaVu Sans'})
fig, ax = plt.subplots(figsize=(3.6, 3.6))
fig.patch.set_alpha(0)
fig.subplots_adjust(left=.02, right=.98, bottom=.02, top=.98)
wedges, _, labels = ax.pie([n for _, n, _ in sources], colors=[c for _, _, c in sources],
    startangle=90, counterclock=False, autopct=lambda p: f'{p:.1f}%' if p >= 4 else '',
    pctdistance=.76, wedgeprops={'linewidth': 1.5, 'edgecolor': 'white'},
    textprops={'fontsize': 12, 'color': '#fff', 'weight': 'semibold'})
for wedge, (name, _, _) in zip(wedges, sources):
    wedge.set_gid(name.lower().replace(' ', '-'))
labels[2].set_color('#49372c')
ax.axis('equal')
fig.savefig(DEST / 'composition.svg', transparent=True, metadata={'Date': None,
    'Title': 'Yuheng training data composition',
    'Description': '; '.join(f'{name}: {n / total * 100:.1f}%' for name, n, _ in sources)})
plt.close(fig)
public = {'approximate_total': f'~{round(total / 1000)}k trajectories', 'sources': [
    {'name': name, 'percentage': round(n / total * 100, 1), 'color': color} for name, n, color in sources]}
(DEST / 'composition.json').write_text(json.dumps(public, indent=2) + '\n')
legend = '\n'.join(f'                <li><i style="--source-color: {color}" aria-hidden="true"></i><span>{name}</span><strong>{n / total * 100:.1f}%</strong></li>' for name, n, color in sources)
page = ROOT / 'index.html'
html = page.read_text()
start = html.index('              <!-- training-source-legend:start -->')
end = html.index('              <!-- training-source-legend:end -->', start)
html = html[:start] + '              <!-- training-source-legend:start -->\n' + legend + '\n' + html[end:]
page.write_text(html)
print(f'Training composition: {total} trajectories, displayed as ~{round(total / 1000)}k; 8 sources.')
