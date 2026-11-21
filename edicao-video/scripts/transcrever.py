#!/usr/bin/env python3
"""Transcreve um vídeo/áudio com Whisper (faster-whisper), com tempo de cada palavra.

Uso:
    python3 scripts/transcrever.py material-bruto/video.mp4
    python3 scripts/transcrever.py video.mp4 --modelo small --saida transcricoes/

Gera, na pasta de saída (padrão: transcricoes/):
    <nome>.json  -> segmentos e palavras com início/fim em segundos (usado pelo Remotion)
    <nome>.srt   -> legenda padrão, para conferir ou subir em outra plataforma
    <nome>.txt   -> texto corrido, com o tempo de cada frase
"""
import argparse
import json
import os
import subprocess
import time
from pathlib import Path

import numpy as np

# Baixa o modelo por HTTP simples (os hosts do Hugging Face liberados no ambiente).
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

from faster_whisper import WhisperModel  # noqa: E402


def carregar_audio(caminho: Path) -> np.ndarray:
    """Extrai o áudio com ffmpeg (mono, 16 kHz, float32), como o Whisper espera."""
    cmd = ["ffmpeg", "-nostdin", "-v", "error", "-i", str(caminho),
           "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"]
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def ts_srt(t: float) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("arquivo")
    p.add_argument("--modelo", default="turbo", help="tiny, base, small, medium, large-v3, turbo")
    p.add_argument("--idioma", default="pt")
    p.add_argument("--saida", default="transcricoes")
    p.add_argument("--vocabulario", default=None,
                   help="nomes que o Whisper deve acertar (padrão: lê vocabulario.txt)")
    a = p.parse_args()

    vocab = a.vocabulario
    vocab_arq = Path(__file__).resolve().parent.parent / "vocabulario.txt"
    if vocab is None and vocab_arq.exists():
        linhas = [l.strip() for l in vocab_arq.read_text().splitlines()]
        vocab = ", ".join(l for l in linhas if l and not l.startswith("#"))

    src = Path(a.arquivo)
    out = Path(a.saida)
    out.mkdir(parents=True, exist_ok=True)

    t0 = time.time()
    model = WhisperModel(a.modelo, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        carregar_audio(src),
        language=a.idioma,
        word_timestamps=True,
        vad_filter=True,
        beam_size=5,
        hotwords=vocab or None,
    )

    segs = []
    for s in segments:
        segs.append({
            "inicio": round(s.start, 3),
            "fim": round(s.end, 3),
            "texto": s.text.strip(),
            "palavras": [
                {"palavra": w.word.strip(), "inicio": round(w.start, 3), "fim": round(w.end, 3)}
                for w in (s.words or [])
            ],
        })

    base = out / src.stem
    data = {"arquivo": src.name, "idioma": info.language, "duracao": round(info.duration, 3), "segmentos": segs}
    base.with_suffix(".json").write_text(json.dumps(data, ensure_ascii=False, indent=2))

    with base.with_suffix(".srt").open("w") as f:
        for i, s in enumerate(segs, 1):
            f.write(f"{i}\n{ts_srt(s['inicio'])} --> {ts_srt(s['fim'])}\n{s['texto']}\n\n")

    with base.with_suffix(".txt").open("w") as f:
        for s in segs:
            f.write(f"[{s['inicio']:6.2f} - {s['fim']:6.2f}] {s['texto']}\n")

    n = sum(len(s["palavras"]) for s in segs)
    print(f"OK: {len(segs)} frases, {n} palavras, {info.duration:.1f}s de mídia em {time.time() - t0:.1f}s")
    print(f"-> {base}.json / .srt / .txt")


if __name__ == "__main__":
    main()
