# AI 工作台 for iPad

一个独立的浏览器聊天客户端，用于连接你已有的第三方 OpenAI/Codex 兼容服务。它不依赖桌面 Codex 应用，不使用 PadCode 的编辑器，也不包含任何 API Key。

已发布地址：

```text
https://liming0320-guo.github.io/padcode/web-assistant/
```

## 功能

- 支持 Chat Completions 与 Responses API
- 流式文字输出、停止生成、连接测试
- 多会话记录保存在当前 iPad 浏览器
- 安全渲染 Markdown、代码块和复制按钮
- API Key 默认只保存在当前浏览会话
- PWA 主屏幕安装和离线外壳
- 手机、iPad 竖屏和横屏响应式布局

## 最简单方式：浏览器直连

1. 将 `web-assistant` 目录部署到 GitHub Pages、Cloudflare Pages 或 Netlify。
2. 用 iPad Safari 打开 HTTPS 地址。
3. 点击“接口设置”。
4. 填写第三方 Base URL、模型名称和 API Key。
5. 选择 Chat Completions 或 Responses API，先点击“测试连接”。

例如 Base URL 填写：

```text
https://your-service.example/v1
```

客户端会自动请求：

```text
https://your-service.example/v1/chat/completions
```

或：

```text
https://your-service.example/v1/responses
```

如果第三方服务禁止浏览器跨域请求，浏览器会显示连接失败，此时使用下面的代理方式。

## 服务端代理方式

目录中的 `api/chat.js` 是 Vercel Serverless Function。把 `web-assistant` 作为 Vercel 项目部署，然后在项目环境变量中配置：

```text
UPSTREAM_BASE_URL=https://your-service.example/v1
UPSTREAM_API_KEY=你的第三方Key
UPSTREAM_ORGANIZATION=
```

部署后，在 iPad 的接口设置中填写：

```text
接口地址：https://你的域名/api/chat
接口类型：与第三方服务一致
模型名称：你的模型
API Key：留空
```

代理方式不会把上游 Key 发送给浏览器。

## 本机测试

因为纯静态网站不需要构建步骤，可以运行任意静态服务器。本机测试可直接打开 `index.html`，但 PWA 安装必须使用 HTTPS 或 localhost。

## 安全说明

- 直连模式下，Key 会保存在 Safari 的站点存储中，并直接发送给你填写的第三方服务。
- 共用 iPad 不要勾选“记住 API Key”。
- 不要在对话里发送密码、私钥或无关的高敏感数据。
- 部署第三方代理时，应确认服务条款允许当前用途。
