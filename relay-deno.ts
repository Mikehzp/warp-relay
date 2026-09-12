// relay-deno.ts — Deno Deploy 版：WebSocket ⇄ TCP 中继
// 与 relay.py / tunnel-client.py 协议完全一致：
//   客户端连 wss://<host>/<TOKEN>  →  发文本控制帧 {"host":"x","port":443}
//   服务端 TCP 连上后回文本 "OPEN"，之后双向往返二进制
// 需要环境变量 TUNNEL_TOKEN（Deno Deploy 面板里设置）。
const TOKEN = (Deno.env.get("TUNNEL_TOKEN") ?? "").trim();
if (TOKEN.length < 16) throw new Error("TUNNEL_TOKEN 未设置或太短，拒绝启动");
const PATH = "/" + TOKEN;

function handle(req: Request): Response {
  const url = new URL(req.url);
  const isWs = (req.headers.get("upgrade") ?? "").toLowerCase() === "websocket";

  if (!isWs) {
    if (url.pathname === "/") return new Response("relay ok\n");
    return new Response("not found\n", { status: 404 });
  }
  if (url.pathname !== PATH) return new Response("unauthorized\n", { status: 403 });

  const { socket: ws, response } = Deno.upgradeWebSocket(req);
  let conn: Deno.Conn | null = null;

  const kill = () => { try { conn?.close(); } catch { /* ignore */ } conn = null; };

  ws.onmessage = async (ev: MessageEvent) => {
    const data = ev.data;

    // 1) 文本帧 = 控制帧：建立 TCP
    if (typeof data === "string") {
      if (conn) return;                       // 已连接，忽略重复控制帧
      let ctl: { host?: string; port?: number };
      try { ctl = JSON.parse(data); } catch { return; }
      if (!ctl?.host || !ctl?.port) return;
      try {
        conn = await Deno.connect({ hostname: String(ctl.host), port: Number(ctl.port) });
      } catch (e) {
        try { ws.send("ERR " + (e as Error).message); } catch { /* ignore */ }
        try { ws.close(); } catch { /* ignore */ }
        return;
      }
      try { ws.send("OPEN"); } catch { /* ignore */ }

      // TCP → WebSocket
      (async () => {
        const buf = new Uint8Array(1 << 16);
        try {
          while (true) {
            const n = await conn!.read(buf);
            if (n === null) break;
            ws.send(buf.slice(0, n));
          }
        } catch { /* ignore */ }
        kill();
        try { ws.close(); } catch { /* ignore */ }
      })();
      return;
    }

    // 2) 二进制帧 = 原始字节：写进 TCP
    if (!conn) return;
    let bytes: Uint8Array;
    if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
    else if (ArrayBuffer.isView(data)) bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    else return;
    try { await conn.write(bytes); } catch (e) {
      try { ws.send("ERR " + (e as Error).message); } catch { /* ignore */ }
      try { ws.close(); } catch { /* ignore */ }
    }
  };

  ws.onclose = kill;
  ws.onerror = kill;
  return response;
}

const port = Number(Deno.env.get("PORT") ?? 8000);
const cert = Deno.env.get("TLS_CERT");
const key = Deno.env.get("TLS_KEY");

// 本地自测时用 TLS_CERT/TLS_KEY 起 443；Deno Deploy 上不设这两个变量（边缘已终止 TLS）
const opts = (cert && key)
  ? { port, cert: Deno.readTextFileSync(cert), key: Deno.readTextFileSync(key) }
  : { port };

console.log(`relay-deno listening on :${port} (tls=${!!(cert && key)})`);
Deno.serve(opts, handle);
