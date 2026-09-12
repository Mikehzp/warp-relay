# deno-relay

Deno Deploy 版 WebSocket ⇄ TCP 中继（协议与 Python 版一致）。

## 部署
1. https://dash.deno.com → Sign in with GitHub → New Project → Deploy from GitHub repo（选本仓库）
   - Entry point / Main file: `relay-deno.ts`
2. 项目 Settings → Environment Variables 加 `TUNNEL_TOKEN` = 本地生成的密钥
3. 访问 `https://<project>.deno.dev/` 应返回 `relay ok`

## 协议
- `wss://<project>.deno.dev/<TUNNEL_TOKEN>` 建连
- 客户端发文本控制帧 `{"host":"cctq.ai","port":443}`，服务端回 `OPEN`，随后二进制帧双向透传
