# PadCode

PadCode 是一个为 iPad 和触控设备优化的免费网页代码工作台。它完全运行在浏览器中，不需要后端，也不会把项目代码上传到服务器。

## 功能

- HTML、CSS、JavaScript 多文件编辑
- CodeMirror 语法高亮、行号、括号匹配和自动缩进
- 实时网页预览与可折叠控制台
- `localStorage` 自动保存，刷新页面不会丢失
- 导入外部 `.html`、`.css`、`.js` 文件
- 将所有代码导出为一个独立的 HTML 文件
- iPad 横屏双栏、竖屏代码/预览切换
- PWA 离线缓存和主屏幕安装支持

## 启动

桌面浏览器可以直接打开 `index.html`。PWA 安装和 Service Worker 需要部署到 HTTPS 地址。

重新生成包含全部 CSS、JavaScript 和编辑器的单文件版本：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\build-standalone.ps1
```

生成后的 `PadCode-standalone.html` 可以单独复制到 iPad。单文件版不需要服务器或网络，但无法使用 Service Worker 离线安装功能。

## 从 iPad 免费发布

不需要电脑或命令行：

1. 在 iPad 的“文件”App 中复制 `PadCode-standalone.html`，并重命名为 `index.html`。
2. 用 Safari 登录 GitHub，新建一个仓库，通过网页上传这个 `index.html`。
3. 打开仓库的 `Settings` → `Pages`，选择从 `main` 分支根目录发布。
4. 等 GitHub 生成 HTTPS 地址后，用 Safari 打开该地址。

在 iPad Safari 中点击“分享” → “添加到主屏幕”，即可像 App 一样使用。所有项目仍只保存在该 iPad 的浏览器存储中，建议定期使用“导出”备份。

## 键盘快捷键

- 运行预览：`⌘ Enter` 或 `Ctrl Enter`
- 立即保存：`⌘ S` 或 `Ctrl S`
- 插入缩进：`Tab`

CodeMirror 5 以 MIT License 分发，许可文本位于 `vendor/codemirror/LICENSE`。
