# warp-relay

一个几十行的 WebSocket ⇄ TCP 中继：让境内的浏览器借一台境外免费机器出去。
协议与本地客户端 `tunnel-client.py` 完全一致，客户端不用改。

## 协议
1. `wss://<你的服务>.onrender.com/<TUNNEL_TOKEN>`
2. 连上后先发一帧 JSON：`{"host":"www.cctq.ai","port":443}`
3. 收到文本 `OPEN` 后，之后所有二进制帧就是裸 TCP 字节流（双向）

`GET /` → `relay ok`（给平台做健康检查）

## 在 Render 上部署（免费、免信用卡）
1. 用 GitHub 登录 https://render.com
2. 右上 **New +** → **Blueprint** → 选本仓库 → **Apply**
3. 面板提示填 `TUNNEL_TOKEN`（一串 32 位十六进制）→ **Create**
4. 等 1～2 分钟，拿到 `https://xxx.onrender.com`
5. 客户端指向它：`python3 tunnel-client.py --host xxx.onrender.com`

免费实例闲置 15 分钟休眠，第一次唤醒约 1 分钟；`keepalive.sh` 可保持常热：
`bash keepalive.sh https://xxx.onrender.com`
