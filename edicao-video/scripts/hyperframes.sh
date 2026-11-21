#!/usr/bin/env bash
# Roda o HyperFrames usando o Chrome que já vem instalado na máquina, sem telemetria.
# Uso: scripts/hyperframes.sh init minha-animacao --example blank --non-interactive --resolution portrait
#      cd minha-animacao && ../scripts/hyperframes.sh render -o saida.mp4
DIR="$(cd "$(dirname "$0")/.." && pwd)"
if [ -z "${HYPERFRAMES_BROWSER_PATH:-}" ]; then
	HYPERFRAMES_BROWSER_PATH=$(ls -d /opt/pw-browsers/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell 2>/dev/null | tail -1)
	export HYPERFRAMES_BROWSER_PATH
fi
export DO_NOT_TRACK=1 HYPERFRAMES_NO_TELEMETRY=1 HYPERFRAMES_SKIP_SKILLS=1
exec "$DIR/node_modules/.bin/hyperframes" "$@"
