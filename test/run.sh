#!/usr/bin/env bash
# 跑 Game/test 下的全部测试。需要 Node 18+；本机若没有全局 node，会回退到 DSH 自带的运行时。
set -euo pipefail
cd "$(dirname "$0")"

NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ]; then
  for p in "$HOME/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node"; do
    if [ -x "$p" ]; then NODE_BIN="$p"; break; fi
  done
fi
if [ -z "$NODE_BIN" ]; then
  echo "找不到 node，请先安装 Node 18+ 再跑测试。" >&2
  exit 1
fi

echo "node: $NODE_BIN"
exec "$NODE_BIN" run.mjs
