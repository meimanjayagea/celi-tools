#!/bin/sh
set -eu

CLAMD_CONFIG=/etc/clamav/clamd.conf
FRESHCLAM_CONFIG=/etc/clamav/freshclam.conf
API_PID=
SCANNER_SUPERVISOR_PID=

# Some container hosts invoke ENTRYPOINT without Docker's CMD arguments.
if [ "$#" -eq 0 ]; then
  set -- node /app/apps/api/src/server.mjs
fi

shutdown() {
  trap - TERM INT EXIT
  for pid in "$API_PID" "$SCANNER_SUPERVISOR_PID"; do
    if [ -n "$pid" ]; then kill -TERM "$pid" 2>/dev/null || true; fi
  done
  for pid in "$API_PID" "$SCANNER_SUPERVISOR_PID"; do
    if [ -n "$pid" ]; then wait "$pid" 2>/dev/null || true; fi
  done
}
trap shutdown TERM INT EXIT

# Bind the API port immediately: /ready and file scans stay fail-closed while
# signatures download and clamd loads its database in the background.
runuser -u app -- "$@" &
API_PID=$!

(
  CLAMD_PID=
  FRESHCLAM_PID=
  stop_scanner() {
    trap - TERM INT EXIT
    for pid in "$CLAMD_PID" "$FRESHCLAM_PID"; do
      if [ -n "$pid" ]; then kill -TERM "$pid" 2>/dev/null || true; fi
    done
    for pid in "$CLAMD_PID" "$FRESHCLAM_PID"; do
      if [ -n "$pid" ]; then wait "$pid" 2>/dev/null || true; fi
    done
  }
  trap stop_scanner TERM INT EXIT
  while :; do
    if ! env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin HOME=/tmp TMPDIR=/tmp \
      runuser -u clamav -- freshclam --config-file="$FRESHCLAM_CONFIG" --stdout; then
      echo "ClamAV database update failed; retrying. File scans remain unavailable." >&2
      sleep 15
      continue
    fi
    env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin HOME=/tmp TMPDIR=/tmp \
      runuser -u clamav -- freshclam --config-file="$FRESHCLAM_CONFIG" --daemon --foreground --pid=/tmp/freshclam.pid &
    FRESHCLAM_PID=$!
    env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin HOME=/tmp TMPDIR=/tmp \
      runuser -u clamav -- clamd --config-file="$CLAMD_CONFIG" --foreground &
    CLAMD_PID=$!
    wait "$CLAMD_PID" || true
    kill -TERM "$FRESHCLAM_PID" 2>/dev/null || true
    wait "$FRESHCLAM_PID" 2>/dev/null || true
    CLAMD_PID=
    FRESHCLAM_PID=
    echo "ClamAV stopped; retrying. File scans remain unavailable." >&2
    sleep 15
  done
) &
SCANNER_SUPERVISOR_PID=$!

set +e
wait "$API_PID"
status=$?
set -e
exit "$status"
