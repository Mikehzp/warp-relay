#!/bin/bash
# 每 10 分钟敲一下 Render 的 /，避免免费实例 15 分钟休眠（首次唤醒要 ~1 分钟）
URL="${1:?用法: bash keepalive.sh https://xxx.onrender.com}"
while true; do
  printf '%s  %s\n' "$(date +%H:%M:%S)" \
    "$(curl -s -o /dev/null -w 'http=%{http_code} time=%{time_total}s' --max-time 70 "$URL/")"
  sleep 600
done
