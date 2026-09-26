#!/bin/zsh
# Scratch runner: TAG=before|after OUT=<dir> ./runall.sh
cd "$(dirname "$0")/.."
run() { TAG=$TAG LOCALE=$1 WEBGL=$2 W=$3 H=$4 node .audit-233/audit.mjs > "$OUT/$TAG-$1-$2-$3x$4.txt" 2>&1; }
run en 1 360 740
run es 1 360 740
run en 0 360 740
run en 1 1280 800
run en 1 360 640
