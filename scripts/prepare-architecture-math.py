"""Render architecture notation with consistent mathematical italics and subscripts."""
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/architecture-math'
DEST.mkdir(parents=True, exist_ok=True)
plt.rcParams.update({'mathtext.fontset':'stix','svg.fonttype':'path','svg.hashsalt':'yuheng-architecture'})
expressions = {
    'k1':r'k_1', 'k2':r'k_2', 'kn':r'k_n',
    'p1':r'p_1', 'p2':r'p_2', 'pn':r'p_n', 'xt':r'x_t',
    'probabilities':r'\pi_1,\ \pi_2,\ \ldots,\ \pi_n',
    'weighted-progress':r'\hat{p}=\sum_{i=1}^{n}\pi_i\,p_i',
}
symbols = {'k1', 'k2', 'kn', 'p1', 'p2', 'pn', 'xt'}
for name, expr in expressions.items():
    if name in symbols:
        # Identical canvas and baseline prevent tight bounding boxes from rescaling subscripts.
        fig = plt.figure(figsize=(.5, .52)); fig.patch.set_alpha(0)
        fig.text(.08, .30, '$'+expr+'$', fontsize=24, color='#493b37', va='baseline')
        fig.savefig(DEST / f'{name}.svg', transparent=True, metadata={'Date':None,'Title':expr})
    else:
        fig = plt.figure(figsize=(4,1));fig.patch.set_alpha(0)
        text = fig.text(0, .5, '$'+expr+'$',fontsize=24,color='#493b37',va='center')
        fig.canvas.draw()
        bbox = text.get_window_extent(fig.canvas.get_renderer()).transformed(fig.dpi_scale_trans.inverted()).padded(.035)
        fig.savefig(DEST / f'{name}.svg',bbox_inches=bbox,transparent=True,metadata={'Date':None,'Title':expr})
    if name in symbols:
        path = DEST / f'{name}.svg'
        path.write_text('\n'.join(line.rstrip() for line in path.read_text().splitlines()) + '\n')
    plt.close(fig)
print('Rendered 9 mathematical SVGs; all seven input symbols share the same canvas, font size, and baseline.')
