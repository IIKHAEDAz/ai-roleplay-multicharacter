#!/bin/zsh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=4173
URL="http://127.0.0.1:${PORT}/roleplay-studio/?v=20260729-guide9#top"

if ! /usr/sbin/lsof -nP -iTCP:${PORT} -sTCP:LISTEN >/dev/null 2>&1; then
  (cd "$ROOT" && nohup /usr/bin/python3 -m http.server "$PORT" --bind 127.0.0.1 >/tmp/roleplay-studio-server.log 2>&1 </dev/null &)
  sleep 1
fi

/usr/bin/open "$URL"
