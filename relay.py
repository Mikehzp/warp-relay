#!/usr/bin/env python3
"""Render 免费实例上的 WebSocket ⇄ TCP 中继（协议与 CF Worker 版完全一致，
所以本地客户端 tunnel-client.py 不用改，只把 --host 换成 xxx.onrender.com）。"""
import asyncio
import json
import os

from websockets.asyncio.server import serve

TOKEN = os.environ.get("TUNNEL_TOKEN", "").strip()
if not TOKEN:
    raise SystemExit("未设置 TUNNEL_TOKEN，拒绝以开放中继启动")
if len(TOKEN) < 16:
    raise SystemExit("TUNNEL_TOKEN 太短（至少 16 位）")
PORT = int(os.environ.get("PORT", "10000"))


async def process_request(connection, request):
    # Render 的健康检查走普通 HTTP GET /
    if request.path == "/":
        return connection.respond(200, "relay ok\n")
    return None


async def handler(ws):
    path = ws.request.path.split("?")[0]
    if path != f"/{TOKEN}":
        await ws.close(1008, "unauthorized")
        return

    try:
        first = await asyncio.wait_for(ws.recv(), timeout=20)
    except Exception:
        return
    if isinstance(first, bytes):
        first = first.decode(errors="replace")
    try:
        req = json.loads(first)
        host, port = str(req["host"]), int(req["port"])
    except Exception:
        await ws.send("ERR bad request")
        await ws.close()
        return

    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=20)
    except Exception as e:
        await ws.send("ERR " + str(e))
        await ws.close()
        return

    await ws.send("OPEN")

    async def ws_to_tcp():
        try:
            async for msg in ws:
                if isinstance(msg, str):
                    continue
                writer.write(msg)
                await writer.drain()
        except Exception:
            pass
        finally:
            try:
                writer.close()
            except Exception:
                pass

    async def tcp_to_ws():
        try:
            while True:
                data = await reader.read(65536)
                if not data:
                    break
                await ws.send(data)
        except Exception:
            pass
        finally:
            try:
                await ws.close()
            except Exception:
                pass

    await asyncio.gather(ws_to_tcp(), tcp_to_ws())


async def main():
    async with serve(handler, "0.0.0.0", PORT, process_request=process_request,
                     ping_interval=30, ping_timeout=60, max_size=None):
        print(f"relay listening on 0.0.0.0:{PORT}", flush=True)
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
