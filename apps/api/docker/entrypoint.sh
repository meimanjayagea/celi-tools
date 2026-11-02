#!/bin/sh
set -eu

CLAMD_CONFIG=/etc/clamav/clamd.conf
FRESHCLAM_CONFIG=/etc/clamav/freshclam.conf

# Do not accept traffic until a current signature database is available.
env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin HOME=/tmp TMPDIR=/tmp \
  runuser -u clamav -- freshclam --config-file="$FRESHCLAM_CONFIG" --stdout

env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin HOME=/tmp TMPDIR=/tmp \
  runuser -u clamav -- freshclam --config-file="$FRESHCLAM_CONFIG" --daemon --foreground --pid=/tmp/freshclam.pid &
FRESHCLAM_PID=$!
env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin HOME=/tmp TMPDIR=/tmp \
  runuser -u clamav -- clamd --config-file="$CLAMD_CONFIG" --foreground &
CLAMD_PID=$!
API_PID=

shutdown() {
  trap - TERM INT EXIT
  for pid in "$API_PID" "$CLAMD_PID" "$FRESHCLAM_PID"; do
    if [ -n "$pid" ]; then kill -TERM "$pid" 2>/dev/null || true; fi
  done
  for pid in "$API_PID" "$CLAMD_PID" "$FRESHCLAM_PID"; do
    if [ -n "$pid" ]; then wait "$pid" 2>/dev/null || true; fi
  done
}
trap shutdown TERM INT EXIT

attempt=0
until clamdscan --config-file="$CLAMD_CONFIG" --ping=1 --quiet >/dev/null 2>&1; do
  if ! kill -0 "$CLAMD_PID" 2>/dev/null || [ "$attempt" -ge 120 ]; then
    echo "ClamAV did not become ready; refusing to start the file API." >&2
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 1
done

runuser -u app -- "$@" &
API_PID=$!
set +e
wait "$API_PID"
status=$?
set -e
exit "$status"
