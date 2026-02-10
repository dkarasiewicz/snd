#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${SND_REPO_URL:-https://github.com/dkarasiewicz/snd.git}"
INSTALL_DIR="${SND_INSTALL_DIR:-$HOME/.snd/app}"
BIN_DIR="${SND_BIN_DIR:-$HOME/.local/bin}"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is required (>=22)" >&2
  exit 1
fi
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(\".\")[0])')"
if [[ "$NODE_MAJOR" -lt 22 ]]; then
  echo "node >=22 is required (detected $(node -v))" >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null 2>&1 || true
    corepack prepare pnpm@latest --activate
  else
    echo "pnpm is required" >&2
    exit 1
  fi
fi

mkdir -p "$(dirname "$INSTALL_DIR")"
if [[ "$INSTALL_DIR" == "/" || "$INSTALL_DIR" == "" ]]; then
  echo "invalid install dir: $INSTALL_DIR" >&2
  exit 1
fi
rm -rf "$INSTALL_DIR"
git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"

cd "$INSTALL_DIR"
pnpm install
pnpm build

mkdir -p "$BIN_DIR"
cp dist/index.js "$BIN_DIR/snd"
chmod +x "$BIN_DIR/snd"

echo "snd installed at $BIN_DIR/snd"
echo "If needed: export PATH=\"$BIN_DIR:$PATH\""
echo "Next: snd init --wizard"
