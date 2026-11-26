# 一步 · 小伴

一个中英文学习任务桌宠演示。点小猫可以查看眼前的一小步，也可以进入「我的任务」选择作业、求助、休息，再接着做。完成小步会获得经验和爪币，可以为小猫兑换服饰和特效。

## 本地运行

安装 Node.js 18 或更高版本，在仓库根目录运行以下命令。启动网页只需 Node.js 自带的模块。

```sh
node server.cjs
```

打开 [本地书桌](http://127.0.0.1:53300/)。任务页位于 `/tasks.html`，装扮店位于 `/shop.html`。按 Ctrl+C 停止服务。

## 代码地图

| 位置 | 内容 |
|---|---|
| `dist/index.html`、`dist/pet.html`、`dist/pet.js`、`dist/pet.css` | 书桌与兼容入口、小猫交互、页面内提醒、拖动和任务窗口 |
| `dist/tasks.html`、`dist/app.js`、`dist/styles.css` | 作业列表、当前步骤、卡住求助、休息续做、计时、便签和通用样式 |
| `dist/model.js` | 固定示例作业、状态转换、经验和等级、浏览器存档 |
| `dist/shop.html`、`dist/shop.js`、`dist/wardrobe.js`、`dist/wardrobe.css` | 商品、试衣镜、爪币兑换、穿戴和特效 |
| `dist/language.js`、`dist/english.js` | 中英文切换和译文 |
| `dist/kitten/` | 原版及穿戴版的四种姿势动画、减少动态效果时的静帧、商品图标 |
| `server.cjs` | 本地静态网页服务器 |
| `tests/` | 任务规则测试和桌面、小屏、键盘、语言及商店交互测试 |
| `tools/render-kitten.cjs` | 可选美术工具，从自备的 2×2 透明姿势图集重新导出小猫 WebP。运行演示直接使用仓库中的成品素材 |

`dist/` 同时是网页源码和静态发布目录，编辑其中的 HTML、CSS 或 JavaScript 后刷新即可预览。部署到静态托管服务时，将发布目录设为 `dist`，入口为 `index.html`。

演示使用预写任务和建议，进度保存在当前浏览器的本地存储中。提醒需要保持页面打开。

## 验证

任务模型测试使用 Node.js 内置测试器，可直接运行。

```sh
node --test tests/model.test.cjs
```

浏览器测试需要 Node.js 20.9 或更高版本、Google Chrome 和开发依赖。在仓库目录运行 `npm install`，保持本地服务器在默认端口运行，再从另一个终端运行 `npm run test:ui`。测试截图写入已被 Git 忽略的 `test-results/`。
