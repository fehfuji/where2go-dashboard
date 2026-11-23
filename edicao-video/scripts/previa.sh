#!/usr/bin/env bash
# Gera a versão para a Central Where2Go (até 1080p e abaixo de 19 MB), que aceita arquivos de até 20 MB.
# É o arquivo que a equipe assiste, comenta e baixa ("Baixar vídeo") para postar.
# Uso: scripts/previa.sh exportados/x.mp4 exportados/x-previa.mp4
set -euo pipefail
ENTRADA="$1"
SAIDA="${2:-${1%.*}-previa.mp4}"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$ENTRADA")
# Orçamento de 18 MB: 128 kb/s de áudio, o resto para o vídeo (máx. 4,5 Mb/s).
VK=$(python3 -c "d=float('$DUR'); v=int(18*8*1024/d - 128); print(max(400, min(v, 4500)))")
ffmpeg -nostdin -v error -y -i "$ENTRADA" -vf "scale=-2:'min(1920,ih)'" \
	-c:v libx264 -preset medium -b:v "${VK}k" -maxrate "$((VK * 3 / 2))k" -bufsize "$((VK * 2))k" \
	-pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart "$SAIDA"
TAM=$(stat -c %s "$SAIDA")
echo "OK: $SAIDA ($(python3 -c "print(round($TAM/1048576,1))") MB, vídeo ${VK} kb/s)"
if [ "$TAM" -gt 20971520 ]; then echo "AVISO: passou de 20 MB; não vai subir na Central." >&2; exit 1; fi
