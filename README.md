# openclaw-message-attachments

`openclaw-message-attachments` 是一个 OpenClaw 插件。

它的作用很简单：
- 从消息中下载附件
- 保存到本地文件
- 把本地路径交给后续 agent / tool 继续处理

适合这类场景：
- 你已经在 OpenClaw 里接入了飞书消息
- 你的 agent 需要处理消息里的文件附件
- 你希望先把附件落到本地，再交给别的工具使用

例如：
- 用户在飞书里发来一个账单附件
- 插件把附件下载到本地
- 下游 agent 再用这个本地文件继续导入或处理

## 当前支持

目前 v1 只支持：
- 飞书消息附件下载
- 统一下载 tool：`message_attachment_download`
- 本地落盘
- 返回结构化成功 / 失败结果

暂不支持：
- 批量下载多个附件
- 上传回平台
- 文件内容解析
- 飞书之外的平台

## 使用前需要准备

### OpenClaw
这是一个 OpenClaw 插件，需要运行在 OpenClaw 的插件环境里。

### 插件配置
安装后，推荐直接在插件配置里填写 Feishu 凭证。

插件配置挂在：

```text
plugins.entries.@lastarla/openclaw-message-attachments.config
```

最小 `openclaw.json` 示例：

```json
{
  "plugins": {
    "entries": {
      "@lastarla/openclaw-message-attachments": {
        "enabled": true,
        "config": {
          "sources": {
            "feishu": {
              "appToken": "your-feishu-app-token"
            }
          }
        }
      }
    }
  }
}
```

完整示例：

```json
{
  "plugins": {
    "entries": {
      "@lastarla/openclaw-message-attachments": {
        "enabled": true,
        "config": {
          "sources": {
            "feishu": {
              "appToken": "your-feishu-app-token",
              "openApiBase": "https://open.feishu.cn/open-apis"
            }
          },
          "download": {
            "maxBytes": 20971520
          }
        }
      }
    }
  }
}
```

其中：
- `sources.feishu.appToken`：飞书应用访问令牌，用于下载附件
- `sources.feishu.openApiBase`：可选，自定义飞书 Open API 地址
- `download.maxBytes`：可选，最大附件大小限制，默认 20MB

修改配置后，建议重启 OpenClaw 让配置生效。

### 环境变量兼容
旧的环境变量方式仍然支持，但只是兼容 fallback：
- `FEISHU_APP_TOKEN`
- `FEISHU_OPEN_API_BASE`
- `OPENCLAW_ATTACHMENT_MAX_BYTES`

如果插件配置和环境变量同时存在，以插件配置为准。

## 插件提供的 tool

安装并加载后，插件会提供：

- `message_attachment_download`

它会：
1. 接收一个消息附件引用
2. 下载附件到本地
3. 返回本地文件路径

## 文件保存位置

默认保存到：

```text
/root/.openclaw/files/attachments/YYYY-MM-DD/
```

如果你想自定义目录，可以继续设置：

- `OPENCLAW_ATTACHMENTS_ROOT`

## 开发

```bash
npm install
npm run check
npm run build
npm run test
```
