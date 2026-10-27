# Keqing — 论文项目主页

标题：**Keqing: Toward a Universal Progress Model**  
作者占位：**Paimon Team**

无需安装依赖或构建的静态网页。支持 GitHub Pages 根域名与项目子路径、移动端和键盘操作。已有 `icon.png` 用作标识和 favicon。

## 本地查看

在当前目录运行：

```bash
npm run dev
```

访问 `http://localhost:4173`。也可以直接打开 `index.html`。网页字体从 Google Fonts 加载；离线时使用系统字体。

## 发布到 GitHub.io

1. 将项目上传到自己的 GitHub 仓库。若希望使用 `https://用户名.github.io/`，仓库名设为 `用户名.github.io`；普通仓库部署后使用 `https://用户名.github.io/仓库名/`。
2. 在仓库 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**。
3. 推送至 `main` 或 `master`，附带的 `.github/workflows/pages.yml` 会发布网站。也可在 Actions 中手动运行工作流。

已关联仓库：`https://github.com/primotion-ai/paimon-eval.github.io`。GitHub Pages 启用后的默认项目地址为 `https://primotion-ai.github.io/paimon-eval.github.io/`。

本地 `.github-token.key` 仅供上传认证，已加入 `.gitignore`，不会提交，也不在 Pages 部署文件清单内。

## 后续补充内容

- **图片 / 视频**：放入 `assets/`，在 `index.html` 替换对应占位。所有图片位置保留为空白示意。
- **论文 / 代码**：将 hero 内禁用的按钮替换为有实际 URL 的 `<a>`，并更新 Resources 区域。
- **榜单**：当前仅写入项目提供的 SOTA 结论，没有编造指标、分数、基线排名或实验结果；发布正式论文时补入具体比较图、评测指标与协议。
- **交互示意**：`script.js` 仅演示“相同语义阶段对齐参考进度”，不会调用模型。示意值不是模型预测或实验数据。
- **方法文字**：介绍 4B / 27B、in-context reference、当前帧和 progress head；训练数据说明保留，未展开监督训练细节。
- **下游应用**：已包含 DSRL 强化微调、AW-BC 离线学习、语义 keyframe 转移、预训练数据清洗，并简述 failure detection。

主文件为 `index.html`、`styles.css` 和 `script.js`。配色变量在 `styles.css` 顶部，主要内容可直接编辑 HTML。

## 检查

```bash
npm run check
```
