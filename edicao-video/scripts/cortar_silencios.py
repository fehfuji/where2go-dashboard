#!/usr/bin/env python3
"""Tira as pausas/silêncios de um vídeo falado (os "jump cuts" dos Reels).

Uso:
    python3 scripts/cortar_silencios.py material-bruto/video.mp4 trabalho/video-cortado.mp4
    python3 scripts/cortar_silencios.py entrada.mp4 saida.mp4 --limiar -32 --pausa 0.4 --folga 0.08

--limiar  volume (dB) abaixo do qual conta como silêncio (padrão -35)
--pausa   pausa mínima, em segundos, para ser cortada (padrão 0.45)
--folga   quanto de "respiro" manter antes/depois de cada fala (padrão 0.08)
"""
import argparse
import re
import subprocess
from pathlib import Path


def duracao(arq: str) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", arq],
        check=True, capture_output=True, text=True,
    ).stdout
    return float(out.strip())


def silencios(arq: str, limiar: float, pausa: float) -> list[tuple[float, float]]:
    log = subprocess.run(
        ["ffmpeg", "-nostdin", "-hide_banner", "-i", arq, "-vn",
         "-af", f"silencedetect=n={limiar}dB:d={pausa}", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    ini = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
    fim = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
    if len(fim) < len(ini):  # silêncio até o fim do arquivo
        fim.append(duracao(arq))
    return list(zip(ini, fim))


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("entrada")
    p.add_argument("saida")
    p.add_argument("--limiar", type=float, default=-35)
    p.add_argument("--pausa", type=float, default=0.45)
    p.add_argument("--folga", type=float, default=0.08)
    a = p.parse_args()

    total = duracao(a.entrada)
    sil = silencios(a.entrada, a.limiar, a.pausa)

    # Trechos com fala = o que sobra entre os silêncios (com uma folga em volta).
    trechos, cursor = [], 0.0
    for s, e in sil:
        ini, fim = cursor, min(total, s + a.folga)
        if fim - ini > 0.12:
            trechos.append((ini, fim))
        cursor = max(0.0, e - a.folga)
    if total - cursor > 0.12:
        trechos.append((cursor, total))

    if not trechos:
        raise SystemExit("Nenhum trecho com fala encontrado. Tente um --limiar mais baixo (ex.: -45).")

    partes, rotulos = [], []
    for i, (s, e) in enumerate(trechos):
        partes.append(f"[0:v]trim={s:.3f}:{e:.3f},setpts=PTS-STARTPTS[v{i}];"
                      f"[0:a]atrim={s:.3f}:{e:.3f},asetpts=PTS-STARTPTS[a{i}];")
        rotulos.append(f"[v{i}][a{i}]")
    grafo = "".join(partes) + "".join(rotulos) + f"concat=n={len(trechos)}:v=1:a=1[v][a]"

    Path(a.saida).parent.mkdir(parents=True, exist_ok=True)
    grafo_arq = Path(a.saida).with_suffix(".filtro.txt")
    grafo_arq.write_text(grafo)
    subprocess.run(
        ["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", a.entrada,
         "-filter_complex_script", str(grafo_arq), "-map", "[v]", "-map", "[a]",
         "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", a.saida],
        check=True,
    )
    grafo_arq.unlink(missing_ok=True)

    novo = duracao(a.saida)
    print(f"OK: {len(trechos)} trechos, {total:.1f}s -> {novo:.1f}s ({total - novo:.1f}s de pausas cortadas)")


if __name__ == "__main__":
    main()
