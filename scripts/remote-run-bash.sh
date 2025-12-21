#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: $0 <remote-script-path>" >&2
  exit 2
fi

TARGET="$1"

# Normalize CRLF -> LF
sed -i 's/\r$//' "$TARGET" || true

# Execute with bash
/bin/bash "$TARGET"
