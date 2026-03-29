# 开发说明

## 项目定位
- 这是一个 OpenClaw 插件仓库，不是 Claude Code plugin，也不是 bookkeeping 业务仓库。
- 本仓库负责把消息附件下载到本地，并通过统一 tool 返回 `download.local_path`。
- v1 只做下载桥接层；不做文件解析、OCR、导入 bookkeeping、上传回平台、多平台并行实现。

## 关键合同
- 统一 tool 名称：`message_attachment_download`
- 输入核心字段：
  - `attachment.source`
  - `attachment.id`
  - `attachment.name`
  - `attachment.source_message_id`
- `message.message_id` 只是当前调用上下文消息，不承担附件定位语义。
- Feishu v1 下载必须使用：
  - `attachment.id = file_key`
  - `attachment.source_message_id = 文件消息自己的 message_id`

## 分层约束
- `src/tools/`：只做 tool schema、注册和分发
- `src/adapters/`：只做平台下载逻辑
- `src/storage.ts`：只做路径、文件名清洗、目录创建、落盘
- `src/errors.ts`：集中维护结构化错误
- `src/types.ts`：集中维护公共类型与结果合同
- 不要把 bookkeeping 业务逻辑放进本插件

## 安全边界
- `purpose = bookkeeping_import` 时，只允许 `.csv` / `.xlsx`
- 默认最大文件大小 20MB，可由环境变量覆盖
- 必须清洗文件名，避免路径穿越和控制字符
- 插件只下载和落盘，不自动执行、不自动解析、不自动导入
- 本地 sandbox 不是平台自动提供的，所有路径和外部请求校验都要在代码里自己做

## 默认存储
- 默认根目录：`/root/.openclaw/files/attachments`
- 日期子目录：`YYYY-MM-DD`
- 文件名优先：`<source_message_id>-<sanitized_name>`

## OpenClaw 约束
- 以 OpenClaw 插件文档为准，不按 Claude plugin 结构假设实现
- 当前仓库保留 `openclaw.plugin.json` 作为插件声明文件
- 入口是 TypeScript 模块 `index.ts`

## 文档分工
- `README.md`：面向分发用户，说明插件能力、依赖、环境变量、使用方式
- `.claude/CLAUDE.md`：面向开发者，记录长期稳定的开发约束
- `plan/openclaw-message-attachments.md`：上游设计依据，不在本仓库内维护实现状态

## 测试要求
- 至少覆盖：
  - 文件名清洗
  - bookkeeping 扩展名限制
  - 缺少 `source_message_id` 的输入错误
  - 基于 mock fetch 的 Feishu 下载成功路径
- 改 adapter / storage / tool 合同时，同步更新测试
