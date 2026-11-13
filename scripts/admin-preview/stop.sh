#!/usr/bin/env bash
# scripts/admin-preview/stop.sh — stops the admin preview, however start.sh started it: the systemd units
# (pfm-admin-preview-*) and any --foreground processes, by the PIDs start.sh saved. The public link dies with the
# tunnel; the next start gets a new one. Stopping the Worker also deletes the preview's secrets (its generated
# file and the copy beside the built Worker); the made-up data stays in .wrangler/admin-preview/state until the
# next start empties it.
#   stop.sh                  stop the tunnel, the proxy and the Worker
#   stop.sh worker proxy     stop only those parts (start.sh uses this, keeping the tunnel and its address)
#   stop.sh tunnel           stop only the tunnel (start.sh --no-tunnel uses this)
# WHY saved PIDs and never pkill: a name match could hit someone else's vite or bun on a shared machine.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
STATE="$REPO/.wrangler/admin-preview"
[ $# -gt 0 ] && PARTS=("$@") || PARTS=(tunnel proxy worker)

for part in "${PARTS[@]}"; do
  case "$part" in
    worker) pat=vite ;;
    proxy) pat=proxy.ts ;;
    tunnel) pat=cloudflared ;;
    *) echo "unknown part: $part (worker, proxy, tunnel)" >&2; exit 2 ;;
  esac
  unit="pfm-admin-preview-$part"
  stopped=0

  if command -v systemctl >/dev/null 2>&1; then
    if systemctl is-active --quiet "$unit"; then
      sudo -n systemctl stop "$unit" && { echo "stopped unit $unit"; stopped=1; }
    fi
    systemctl is-failed --quiet "$unit" && sudo -n systemctl reset-failed "$unit" 2>/dev/null
  fi

  pidf="$STATE/$part.pid"
  if [ -f "$pidf" ]; then
    pid="$(cat "$pidf")"
    # Only a real PID (never 0 or 1: `kill -- -1` would signal every process this user owns) whose command is
    # still the expected part. start.sh made it a process-group leader, so -PID also stops its children
    # (vite preview's workerd).
    if [[ "$pid" =~ ^[0-9]+$ ]] && [ "$pid" -gt 1 ] && ps -o command= -p "$pid" 2>/dev/null | grep -q -- "$pat"; then
      kill -TERM -- "-$pid" 2>/dev/null
      for _ in $(seq 1 20); do kill -0 -- "-$pid" 2>/dev/null || break; sleep 0.5; done
      kill -0 -- "-$pid" 2>/dev/null && kill -KILL -- "-$pid" 2>/dev/null
      echo "stopped $part (process group $pid)"; stopped=1
    fi
    rm -f "$pidf"
  fi

  [ "$stopped" = 1 ] || echo "$part was not running"

  # Only the copy start.sh put beside the built Worker (byte-identical), never a file someone else wrote there.
  if [ "$part" = worker ] && [ -f "$STATE/worker.dev.vars" ]; then
    cmp -s "$STATE/worker.dev.vars" "$REPO/dist/server/.dev.vars" && rm -f "$REPO/dist/server/.dev.vars"
    rm -f "$STATE/worker.dev.vars"
  fi
done
exit 0
