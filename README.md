# PadCode

PadCode 是一个为 iPad 和触控设备优化的浏览器代码工作台。它使用 VS Code 同源的 Monaco 编辑器，不需要本地后端，并可选连接 DeepSeek、通义千问或其他兼容的国内 AI 接口。

## 功能

- 使用 Monaco Editor：多光标、自动补全、参数提示、折叠、括号配对、minimap、查找替换
- VS Code 风格资源管理器、全局搜索、问题、检查点和扩展状态面板
- `F1` 或 `Shift+Cmd+P` 命令面板，提供保存、运行、格式化、搜索等操作
- HTML、CSS、JavaScript 多文件编辑
- 新建、重命名和删除自定义文件，刷新后自动恢复
- Python、Java、C、C++ 独立代码草稿与语法高亮
- Python、Java、C、C++ 的一键复制和 OneCompiler 在线运行入口
- 实时网页预览与可折叠控制台
- `localStorage` 自动保存，刷新页面不会丢失
- 导入外部 `.html`、`.css`、`.js`、`.py`、`.java`、`.c`、`.cpp` 文件
- 将所有代码导出为一个独立的 HTML 文件
- 在 iPad 上通过原生分享面板保存到“文件”App
- iPad 横屏双栏、竖屏代码/预览切换
- PWA 离线缓存和主屏幕安装支持
- AI 助手读取网页文件、代码草稿和运行输出
- 将 AI 生成的完整文件一键应用到项目

## VS Code 功能边界

当前版本覆盖了完整的代码编辑体验、工作台侧栏、命令面板、项目搜索、语言诊断和本地版本检查点，但仍然是浏览器应用，不等同于完整桌面版 VS Code：

- 不能直接访问 iPad 上任意文件夹；导入和导出通过文件选择器完成。
- 没有真实终端、扩展市场和远程 Git 仓库同步。
- Python、Java、C、C++ 的运行入口使用 OneCompiler 免费在线编译器。PadCode 无法跨域直接读取第三方运行结果，因此会复制代码并在新窗口打开运行器。
- 真正的 Web 智能提示和诊断需要 HTTPS 部署；用 `file://` 直接打开时会降级。

## 配置 AI 助手

1. 在 DeepSeek 开放平台、阿里云百炼等正规渠道申请 API Key，并设置用量上限。
2. 在 PadCode 中打开“AI 助手”，点击顶部的“未配置”。
3. 选择 DeepSeek 或通义千问，填写自己的 API Key，然后保存。
4. 输入需求。AI 返回完整文件后，点击“应用文件”即可替换项目并刷新预览。

PadCode 会从浏览器直接请求所选服务的 HTTPS 兼容接口。API Key 默认只保存在当前浏览会话；勾选“在这台 iPad 上记住 API Key”后会写入该站点的浏览器存储。不要在共用设备上勾选，也不要把自己的 Key 发给他人。

AI 生成的内容可能有错误。应用代码前应查看回答，并至少检查一次预览和浏览器控制台。

## 启动

桌面浏览器可以直接打开 `index.html`。PWA 安装和 Service Worker 需要部署到 HTTPS 地址。

本机测试完整 Worker 和 Service Worker 功能时，可在 PowerShell 中运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\serve.ps1 -Port 4173
```

然后访问 `http://127.0.0.1:4173/`。

重新生成包含全部 CSS、JavaScript 和编辑器的单文件版本：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\build-standalone.ps1
```

生成后的 `PadCode-standalone.html` 可以单独复制到 iPad。单文件版会自动使用内置的 CodeMirror 编辑器，不需要服务器即可编辑和预览；使用 AI 或在线运行功能时仍需要网络。

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
- 命令面板：`F1` 或 `⇧ ⌘ P`
- 全局搜索：`⇧ ⌘ F`
- 资源管理器：`⌘ B`
- 打开 AI 助手：`⌘ I`
- 插入缩进：`Tab`

Monaco Editor 和 CodeMirror 5 均以 MIT License 分发。许可文本位于各自的 `vendor` 子目录。
