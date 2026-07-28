#!/bin/bash

PORT=43080
LOG_FILE="$(dirname "$0")/../next.log"

echo "Stopping trend-hub on port $PORT..."
fuser -k "$PORT/tcp" 2>/dev/null
sleep 2

if fuser "$PORT/tcp" 2>/dev/null; then
  echo "Port $PORT still in use, force killing..."
  fuser -k -9 "$PORT/tcp" 2>/dev/null
  sleep 2
fi

echo "Starting trend-hub..."
nohup npm start > "$LOG_FILE" 2>&1 & disown

for i in $(seq 1 10); do
  if curl -s -o /dev/null -w "" http://localhost:$PORT 2>/dev/null; then
    echo "trend-hub started successfully on http://localhost:$PORT"
    exit 0
  fi
  sleep 1
done

echo "Failed to start trend-hub, check $LOG_FILE for details"
exit 1
