#!/usr/bin/env bash
# NAFOJ: build a working FerretDB v1.24.2 binary (Linux/macOS).
# See build.ps1 for why we build from the cloned tag instead of `go install`.
set -euo pipefail
VERSION="${1:-v1.24.2}"
OUT_DIR="${2:-$HOME/.hydro/bin}"
SRC="$(mktemp -d)/ferretdb-src"
git clone --depth 1 --branch "$VERSION" https://github.com/FerretDB/FerretDB.git "$SRC"
printf '%s' "$VERSION" > "$SRC/build/version/version.txt"
mkdir -p "$OUT_DIR"
(cd "$SRC" && go build -trimpath -o "$OUT_DIR/ferretdb" ./cmd/ferretdb)
"$OUT_DIR/ferretdb" --version
echo "FerretDB installed to $OUT_DIR/ferretdb"
