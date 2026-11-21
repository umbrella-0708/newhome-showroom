# 贝壳 × 妙窝生活 · 新房营销服务展示台

静态网站，无需安装依赖或配置密钥。同一网址适配电脑、平板和手机。

## 本地打开

在仓库目录运行 `python3 -m http.server 8080 --directory dist`，然后访问 `http://localhost:8080`。

## 发布到 GitHub Pages

1. 将本目录中的 `dist`、`scripts`、`.github` 和此说明上传到目标仓库的 `main` 分支
2. 在仓库 Settings → Pages → Build and deployment 中，Source 选择 GitHub Actions
3. 在 Actions 中运行 Publish showroom to GitHub Pages，或向 main 推送一次修改
4. 发布完成后，部署任务会给出访问网址

网站使用相对资源地址和 Hash 路由，支持 GitHub Pages 的仓库子路径，无需修改域名或资源前缀。

发布配置依据 [GitHub Pages 官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。Pages 通常为对外访问的网站，发布前确认仓库与网站可见性。

## 内容和行为

- `dist/services.js`：服务目录及单项交付说明
- `dist/manual.js`：方案权益、达人信息、营销策略与案例
- `dist/data.js`：产品版本、参考价格、图片与基础内容
- `dist/configurator.js`：基础方案和单项加配逻辑
- `dist/selection-document.js`、`dist/print.css`：清单展开及 PDF 打印排版
- `dist/responsive.css`：手机与平板布局、触控操作和安全区
- `dist/assets/brand.svg`：新版双品牌组合标识

清单和项目需求保存在访问者当前浏览器，不会上传到服务器。不同域名、不同浏览器之间不自动同步。

## 验证

运行 `node scripts/validate.mjs` 检查入口资源、脚本、服务数据、方案配置和清单明细。GitHub Actions 发布前会自动执行相同检查。

手机版覆盖服务目录、服务详情、达人清单、数字案场、项目案例、方案选择、单项加配、意向清单和 PDF 打印入口；支持系统减少动态效果设置。

交付中已完成脚本、资源和数据检查，关键页面生成与配置操作检查，以及 PDF 样张检查。当前浏览器预览连接不可用，完整窄屏视觉、iOS Safari、Android Chrome 的真机触控和系统打印对话框仍需在发布后复核。

## 使用范围

包含业务产品说明和品牌素材，按授权范围使用。此交付不附加开源许可。
