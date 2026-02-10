#!/usr/bin/env sh
set -eu

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
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "node >=22 is required (detected $(node -v))" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required" >&2
  exit 1
fi

mkdir -p "$(dirname "$INSTALL_DIR")"
if [ "$INSTALL_DIR" = "/" ] || [ -z "$INSTALL_DIR" ]; then
  echo "invalid install dir: $INSTALL_DIR" >&2
  exit 1
fi
rm -rf "$INSTALL_DIR"
git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"

cd "$INSTALL_DIR"
npm install --no-fund --no-audit
npm run build

mkdir -p "$BIN_DIR"
cat > "$BIN_DIR/snd" <<EOF
#!/usr/bin/env sh
exec node "$INSTALL_DIR/dist/index.js" "\$@"
EOF
chmod +x "$BIN_DIR/snd"

echo "snd installed at $BIN_DIR/snd"
echo "If needed: export PATH=\"$BIN_DIR:$PATH\""
echo "Next: snd init --wizard"
