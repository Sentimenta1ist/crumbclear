#!/bin/sh
# Builds dist/crumbclear-<version>.zip for the Chrome Web Store.
# Fails if tests fail or if the zip would contain anything but the extension.
set -eu
cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./manifest.json').version")
OUT="dist/crumbclear-$VERSION.zip"

echo "Running tests..."
node --test test/*.test.mjs > /dev/null 2>&1 || { node --test test/*.test.mjs; echo "Tests failed, not building." >&2; exit 1; }

FILES=$(
  echo manifest.json
  for s in 16 32 48 128; do echo "icons/icon$s.png"; done
  find src -type f ! -name '.*' ! -path '*/.*' | LC_ALL=C sort
)

rm -f "$OUT"
mkdir -p dist
# -X: no extra file attributes, -D: no directory entries
echo "$FILES" | zip -X -D -q "$OUT" -@

# Everything in the zip must be one of the allowed paths, and nothing else.
UNEXPECTED=$(unzip -Z1 "$OUT" | grep -Ev '^(manifest\.json|icons/icon(16|32|48|128)\.png|src/[^.][^/]*(/[^.][^/]*)*)$' || true)
if [ -n "$UNEXPECTED" ]; then
  echo "Unexpected files in $OUT:" >&2
  echo "$UNEXPECTED" >&2
  rm -f "$OUT"
  exit 1
fi
[ "$(unzip -Z1 "$OUT" | wc -l)" -eq "$(echo "$FILES" | wc -l)" ] || { echo "File count mismatch" >&2; exit 1; }

unzip -l "$OUT" | sed '1,3d;$d' | sed '$d' | awk '{ printf "  %8d  %s\n", $1, $4 }'
echo "$OUT: $(unzip -Z1 "$OUT" | wc -l | tr -d ' ') files, $(wc -c < "$OUT" | tr -d ' ') bytes"
