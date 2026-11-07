# Yuheng — 论文项目主页

标题：**Yuheng: Toward Universal Progress Modeling through In-Context Learning and Semantic Alignment**
命名灵感：来自北斗七星的玉衡星，寓意平衡与衡量，与机器人任务进度的衡量相呼应。

作者占位：**Paimon Team**

无需安装依赖或构建的静态网页。支持 GitHub Pages 根域名与项目子路径、移动端和键盘操作。天平图标 `icon.png` 为 1024×1024 透明 PNG，沿用命名说明中的天平造型，采用橙红渐变。矢量原稿为 `assets/yuheng-icon.svg`，浏览器 favicon 使用该 SVG 和 `assets/yuheng-favicon-32.png`。

## 本地查看

在当前目录运行：

```bash
npm run dev
```

访问 `http://localhost:4173`。数据浏览器通过 HTTP 加载 JSON 与 PNG，需要使用上述本地服务器。网页字体从 Google Fonts 加载；离线时使用系统字体。

## 发布到 GitHub.io

1. 将项目上传到自己的 GitHub 仓库。若希望使用 `https://用户名.github.io/`，仓库名设为 `用户名.github.io`；普通仓库部署后使用 `https://用户名.github.io/仓库名/`。
2. 在仓库 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**。
3. 推送至 `main` 或 `master`，附带的 `.github/workflows/pages.yml` 会发布网站。也可在 Actions 中手动运行工作流。

已关联仓库：`https://github.com/primotion-ai/paimon-eval.github.io`。GitHub Pages 启用后的默认项目地址为 `https://primotion-ai.github.io/paimon-eval.github.io/`。

本地 `.github-token.key` 仅供上传认证，已加入 `.gitignore`，不会提交，也不在 Pages 部署文件清单内。

## 后续补充内容

- **图片 / 视频**：放入 `assets/`，在 `index.html` 替换对应占位。除数据集实例外，其余图片位置仍保留为空白示意。
- **论文 / 代码**：将 hero 内禁用的按钮替换为有实际 URL 的 `<a>`，并更新 Resources 区域。
- **榜单**：当前仅写入项目提供的 SOTA 结论，没有编造指标、分数、基线排名或实验结果；发布正式论文时补入具体比较图、评测指标与协议。
- **交互示意**：方法区的 `script.js` 仅演示“相同语义阶段对齐参考进度”，不会调用模型。示意值不是模型预测或实验数据。
- **多本体 / 跨本体迁移**：四项核心能力之一，涵盖夹爪、灵巧手和人手；方法区以“人手成功参考 → 灵巧手同任务轨迹评估”为具体示例。
- **方法文字**：介绍 4B / 27B、in-context reference、当前帧和 progress head；训练数据说明保留，未展开监督训练细节。
- **下游应用**：已包含 DSRL 强化微调、AW-BC 离线学习、语义 keyframe 转移、预训练数据清洗，并简述 failure detection。

主文件为 `index.html`、`styles.css` 和 `script.js`。配色变量在 `styles.css` 顶部，主要内容可直接编辑 HTML。

## 检查

```bash
npm run check
```

## 数据集轨迹浏览器

`dataset-explorer.js` 展示真实标注样例：3 个任务、16 条轨迹、512 张 PNG。
左侧播放或拖动逐帧图片；右侧叠加同任务全部轨迹的最终 `progress`，当前曲线实色加粗，其余曲线透明度 76%。成功轨迹用蓝/绿系，次优用黄系，失败用橙/红系。仅通过下拉框或图例切换轨迹；虚线同步当前帧。包含所有 ICL 参考轨迹，开红抽屉任务的 01–07 均显示。显示帧号从 1 开始，原始索引从 0 开始；播放速度是演示速度，不代表采集 FPS。
点击曲线，只在该段附近显示所点击轨迹的说明气泡，不改变当前选中轨迹、帧位置或播放状态；无模态遮罩，点击外部或按 Escape 关闭。图例用于切换轨迹。目前仅预留说明，不导入原始数据中的 events。待提供准确文本和分段后再接入。

- 公共资源：`assets/annotation-examples/index.json` 与其引用的 PNG。
- 本地源数据：`bench_example/`，已排除 Git 提交；NPZ 按要求删除，原始标注和溯源 JSON 留在本地。
- 重新导出：在包含本地源数据的机器运行 `python3 scripts/prepare-examples.py`。该脚本只导出进度、任务、轨迹类别、参考标记和 PNG，不导出标注文本或机器路径。
- GitHub Pages 直接发布已导出的 assets；无需在 CI 中访问本地源数据。

## Benchmark 结果

`benchmark_results/ood_20261031/` 为本地原始结果目录，不随网站提交。公开资源在 `assets/benchmark/ood_20261031/`，含一张平均总分 Matplotlib SVG、精简 JSON 和完整精度 CSV。

平均分为同轨迹 Overall、跨轨迹 Overall、末帧一致率的等权平均，MAE 不计入平均分。柱状图和表格都按同一方法中最高的未舍入 Average 降序排列。表格默认展示该配置的整行分数，点击方法旁的加号展开同组所有配置。RynnValue 的 Average 不适用，保留在表格末尾，其折叠行按两个 Overall pair 分数的平均值选择。Within-trajectory、Cross-trajectory 和 MAE 默认只显示最左侧的 Overall，点击表头 Overall 可独立向右展开或收起分项。页面数字保留一位小数，每列按原始精度放大并加粗最佳值、为第二名加粗并加下划线（MAE 取最小）。非成功包含次优与失败。

重新生成图表、结果表和公开导出：

```bash
UV_CACHE_DIR=/tmp/yuheng-uv-cache uv run --no-project --with matplotlib==3.11.2 python scripts/prepare-benchmark.py
```

原始内部模型名在生成脚本中映射为公开模型名，页面不展示训练步数。RynnValue 的绝对进度指标及平均分保留为不适用，不补零或按两项计算平均分。

## 方法曲线对比

指标说明下的 `#method-comparison` 展示 12 个任务、106 条轨迹，每条 32 帧。右侧桌面布局为三行两列，六个方法按 benchmark Average 分数降序排列，每张图下方有自己的方法图例，共享的 Progress ground truth 图例居中位于六图上方。每张图的 Astra 真值为黑色虚线，已播放部分不透明度 90%，未来部分 20%；模型曲线只绘制截至当前帧的值，并标出当前位置。首次进入展示、切换任务或轨迹后自动播放一次，暂停、重播、调速和时间轴拖动仍可使用；离开视口或隐藏页面时暂停，返回后继续用户尚未暂停的播放。只有图片成功解码后才同步更新六张曲线，避免图像与数值错位。

本地原始目录 `benchmark_compare_example/` 不提交。运行 `python3 scripts/prepare-comparison.py` 会核对 manifest、CSV、Astra target、模型原始预测和 PNG SHA256，再导出独立的 `assets/benchmark-comparison/index.json` 与 `tasks/` 下的 3,392 张 PNG（约 198 MB，原尺寸原字节）。不再依赖标注示例的图片；不导出原始注释、提示词、推理元数据或 NPZ。模型值原样保留，不另做平滑、插值或归一化。`scripts/comparison-section.html` 是对应 HTML 模板，与首页同步维护。

## Reference scale 图片示例

`EXPLORE THE IDEA` 使用 `assets/scale-explorer/` 的四张 PNG。拖动语义阶段时切换图片和曲线高亮；切换均匀/自定义标尺时，四个曲线值与右下角输出来自同一组数值。横向位置等距，不展示横轴数字；纵轴从 0% 到 100%，间隔 25%。原始图片目录 `explore_the_idea_example/` 留在本地，发布资源保留原图内容。

## User-defined progress scales 结果

`#user-defined-scales` 展示同一条 Close the drawer 轨迹的参考帧 0、17、31，以及 Yuheng 27B 在 `[0, 20, 100]%` / `[0, 60, 100]%` 两种参考标尺下的 32 帧原始预测。曲线标记位于参考帧的实际预测值，不强制贴合标注值。动画只自动播放一遍，停在两条曲线和两套标签均完整显示的比较状态；右上角可手动重播。

原始导出 `capabilities/different_progress_scale/` 留在本地。公开图片、精简数值和桌面/窄屏 SVG 放在 `assets/capabilities/different-progress-scale/`。重新生成：

```bash
UV_CACHE_DIR=/tmp/yuheng-uv-cache uv run --no-project --with matplotlib==3.11.2 python scripts/prepare-scale-comparison.py
```

导出时校验图片 SHA-256、帧索引及 CSV/JSON 数值；不平滑或重新归一化预测。

## Semantic progress alignment 交互

`#semantic-alignment` 展示 Open the bottle 的四条 Yuheng 27B 模型预测曲线。左侧 2×2 图片保留 4:3 原始比例，轨迹名旁按原始 source_quality_label 标记两条 Success、两条 Failure；所选四条轨迹的原始类别与 Astra outcome 一致。右侧箭头以 5% 调整水平虚线。每条轨迹独立选择最近帧：成功轨迹始终显示最近帧；其他轨迹仅在绝对进度差不超过 0.10（含边界）时显示，否则保留空白画面。首次进入视口时自动从 0% 播放至 100%，每 1.2 秒增加 5%，图片加载完成后再计时；离开视口或切换标签页暂停计时。支持暂停、重播，手动调整会停止播放，减少动态效果偏好下不自动播放。阶段说明暂为 0%、25%、50%、100% 的 xxx 占位文案。匹配不平滑、不单调化，相同距离取较早帧；快速操作通过请求版本检查避免旧图片覆盖新结果。

运行 `python3 scripts/prepare-semantic-alignment.py` 从本地 `capabilities/semantic_progress_alignment/open_the_bottle/manifest.json` 导出精简 JSON 和 128 张 PNG 到 `assets/capabilities/semantic-alignment/`。脚本核对所有源文件校验值和 CSV/JSON 中的模型预测，原始 NPZ、Astra 标注和推理配置不发布。旧香蕉示例的源数据和专用 PNG 已删除；其他展示使用的共享 PNG 保留。

图片下方不显示帧号或百分比，图片替代文本仍包含匹配信息以便无障碍访问。

## Cross-embodiment transfer 交互

`#cross-embodiment` 展示轨迹 1（人手 ICL 参考）、3（YAM 机械臂）、5（Wuji 手成功）和 7（Wuji 手失败）。曲线下方的左右按钮逐帧同步四组画面，也支持播放、暂停和重播；手动调整会暂停播放并优先跳转。当前帧左侧曲线不透明，未来部分为 24% 不透明度，全部为连续实线。四组画面在曲线和控制按钮下方以 2×2 排列。

同步轴是四段视频分别均匀采样后的帧位置，不是共同物理时间。公开素材共 128 张原始 320×256 PNG，来自本地 `capabilities/cross_embodiment_transfer/`；运行 `python3 scripts/prepare-cross-embodiment.py` 校验 CSV、JSON 和图片哈希，再导出到 `assets/capabilities/cross-embodiment/`。原始推理配置和提示词不公开。

## One-shot multi-task 扩散展示

`#one-shot-generalization` 使用 `one-shot-animation.js` 将 25 条轨迹（21 个任务）排列为 5×5 网格。按距中心的曼哈顿距离依次播放 1、4、8、8、4 个格子；同一圈同步推进采样帧，每个视频右侧的独立曲线用闭合框围起，只绘制到当前帧；按提供的 Astra outcome，13 条成功为绿色，12 条失败为红色。未播放的格子淡化，已完成的格子保留最终画面。每帧至少停留 170ms，圈间停留 500ms，完整播放一次后停止。右上角支持暂停和重新播放，离开视口或切换标签页暂停计时，减少动态效果偏好下不自动播放。手机保留 5×5 排列并在展示框内横向滚动。

`python3 scripts/prepare-one-shot.py` 从本地 `one_shot_multi_task/` 导出网页所需的 800 张 PNG 与精简 `index.json`，核对校验值和所有 CSV/JSON 模型预测。已有 PNG 在推理之后缩小至 160×120，导出时原样复制，不改动预测；原始 NPZ、标注、reference 文件和路径留在本地。旧的三轨迹源数据和专用网页素材已删除。

## Training data composition

`#training-data` 的白色卡片用饼图展示八个来源的训练轨迹占比，下方只显示约数 `~16k`。计数保存在 `scripts/prepare-training-composition.py`，运行 `UV_CACHE_DIR=/tmp/yuheng-uv-cache uv run --no-project --with matplotlib==3.11.2 python scripts/prepare-training-composition.py` 重新生成 SVG、公开百分比 JSON 和页面图例。说明仅涉及从 Robometer 筛选、使用 GPT 6 Astra 与 GPT 6 Sol 标注训练数据，不涉及 benchmark 标注流程。

## Conceptual overview

`concept-overview.js` 直接复用 `assets/capabilities/cross-embodiment/index.json` 的四个 reference 索引（0、14、18、29，标尺 0%、33%、66%、100%）与 Human hand 的查询帧。02 使用两组半重叠静态图：0、2、4、6 帧依次出现，接着出现省略号，再依次出现 26、28、30、31 帧（倒数第 6、4、2 帧及末帧）。仅加载所需图片。动画按 01 标签、四个关键帧依次出现、02 查询序列、03 输出说明与进度条的顺序播放；总时长 15 秒，结束后保留全图，可手动重播。三条概念进度条保留原示意图的 90%、62%、27%，并非新运行的模型预测。支持暂停、离开视口暂停及减少动态效果设置。

训练数据标题直接复用 `.explorer-copy > .small-label`；卡片内部底部的数据规模对比使用 Robometer 官方项目页和 NimCritic 论文公开规模（约 1M 与约 250k），页面按要求仅显示纯文本。

METHOD 架构图按自下而上的结构呈现：任务 instruction、reference keyframes、对应进度标签、current frame → 输入 token → 横向 Yuheng VLM → projection head → 每个 keyframe 的分类概率 → 概率加权的 keyframe progress → relative progress。token 方块仅表达输入结构，不表示实际序列长度；窄屏在图内水平滚动。

## Pages and architecture notation

顶部导航仅保留 `index.html`（Overview）、`playground.html`、`application.html`。后两页使用同样的背景、页头和页尾；Playground 目前只有页面名与 Coming soon，没有上传或推理功能。首页保留完整的 05 / BEYOND EVALUATION，四个 Explore 按钮链接到 Application 中对应的空白小节锚点，后续再填入应用内容。`content/application-draft.html` 保留原应用文案备份，部署不复制该目录。首页资源区保持 06。页头导航居中，页头页尾均显示 icon + 艺术字 Yuheng。

`concept-overview.js` 在查询图片完全出现之后（10 秒）才淡入模型，11 秒开始展示输出。公式 SVG 由 `scripts/prepare-architecture-math.py` 使用 Matplotlib mathtext 的 STIX 数学字体生成，包含规范的下标和 `p_hat = sum(pi_i * p_i)`；运行方式与其他 Matplotlib 脚本相同。
