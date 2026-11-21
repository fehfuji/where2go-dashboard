#!/usr/bin/env python3
"""Monta o props.json de um projeto do Remotion a partir do vídeo e da transcrição.

Uso:
    python3 scripts/montar_props.py trabalho/video-cortado.mp4 transcricoes/video-cortado.json projetos/meu-reels

Faz duas coisas:
  1. Coloca o vídeo em remotion/public/ (é de lá que o Remotion lê os arquivos).
  2. Cria projetos/<nome>/props.json com a duração, as palavras da legenda e campos
     vazios de gancho, cartelas e zooms, que depois são preenchidos no storyboard.
"""
import argparse
import json
import os
import shutil
import subprocess
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PUBLIC = RAIZ / "remotion" / "public"


def duracao(arq: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(arq)],
        check=True, capture_output=True, text=True,
    ).stdout
    return round(float(out.strip()), 3)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("video")
    p.add_argument("transcricao")
    p.add_argument("projeto", help="pasta do projeto, ex.: projetos/meu-reels")
    a = p.parse_args()

    video = Path(a.video).resolve()
    PUBLIC.mkdir(parents=True, exist_ok=True)
    destino = PUBLIC / video.name
    if destino.exists() or destino.is_symlink():
        destino.unlink()
    try:
        os.link(video, destino)  # sem gastar espaço quando dá
    except OSError:
        shutil.copy2(video, destino)

    trans = json.loads(Path(a.transcricao).read_text())
    palavras = [w for s in trans["segmentos"] for w in s["palavras"]]

    projeto = Path(a.projeto)
    projeto.mkdir(parents=True, exist_ok=True)
    props_arq = projeto / "props.json"
    props = {
        "video": video.name,
        "duracao": duracao(video),
        "gancho": None,
        "cartelas": [],
        "zooms": [],
        "marca": None,
        "estilo": {},
        "palavras": palavras,
    }
    props_arq.write_text(json.dumps(props, ensure_ascii=False, indent=2))
    print(f"OK: {props_arq} ({len(palavras)} palavras, {props['duracao']}s)")
    print(f"Renderizar: npx remotion render Reels exportados/{projeto.name}.mp4 --props={props_arq}")


if __name__ == "__main__":
    main()
