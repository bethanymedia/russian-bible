#!/usr/bin/env bash
# Usage: play_verse_clip.sh Ps 22 1 /tmp/ps22v1.m4a
set -euo pipefail
OSIS=${1:?}; CH=${2:?}; V=${3:?}; OUT=${4:?}
HOST=${BIBLE_HOST:-https://bethanymedia.github.io/russian-bible}
BASE=https://huggingface.co/datasets/enochlev/russian-synodal-bible-kozlov/resolve/main/a1/kozlov
URL="$BASE/$OSIS/$CH.m4a"
curl -fsSL "$HOST/data/kozlov_timings.json" -o /tmp/rb_timings.json
START_END=$(python3 - "$OSIS" "$CH" "$V" /tmp/rb_timings.json <<'PY'
import json, sys
osis, ch, v, path = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
arr = json.load(open(path))[f"{osis}.{ch}"]
i = v - 1
start = arr[i] / 1000
end = (arr[i + 1] / 1000) if i + 1 < len(arr) else ""
print(f"{start} {end}")
PY
)
START=${START_END%% *}; END=${START_END#* }
if [ -n "$END" ]; then
  ffmpeg -y -ss "$START" -to "$END" -i "$URL" -c copy "$OUT"
else
  ffmpeg -y -ss "$START" -i "$URL" -c copy "$OUT"
fi
echo "Wrote $OUT (${START}s–${END:-eof})"
