# Edição de vídeo com IA — Where2Go

Pasta de trabalho para editar Reels/TikToks da Where2Go com o Claude. O usuário
costuma pedir pelo celular (app Claude), em português. Responder em português, curto.

## Pastas
| Pasta | O que tem | Vai pro git? |
|---|---|---|
| `material-bruto/` | vídeos brutos enviados pelo usuário | não |
| `referencias/` | vídeos de referência de estilo | não |
| `trabalho/` | arquivos intermediários (cortes, trechos) | não |
| `transcricoes/` | saída do Whisper (`.json`, `.srt`, `.txt`) | não |
| `projetos/<nome>/` | `storyboard.md` + `props.json` de cada vídeo | **sim** |
| `remotion/` | template Remotion (composição `Reels`) | sim |
| `remotion/public/` | mídia usada no render (vídeo, imagens das cartelas) | só `marca/` |
| `exportados/` | vídeos finais | não (mandar pro usuário) |
| `estilo.md` | guia de estilo — **seguir sempre** | sim |
| `vocabulario.txt` | nomes que o Whisper deve acertar | sim |

## Ferramentas
- **FFmpeg / ffprobe:** cortes, conversões, áudio, folhas de contato.
- **Whisper** (faster-whisper, modelo `turbo`): `scripts/transcrever.py`. Na primeira vez
  baixa o modelo (~1,6 GB) do Hugging Face (hosts liberados no ambiente `where2go-dashboard`).
- **Remotion 4:** `npx remotion render Reels ...`. O `remotion.config.ts` aponta pro Chrome
  headless de `/opt/pw-browsers` (o download do Chrome do Remotion é bloqueado pela rede).
- **HyperFrames:** `scripts/hyperframes.sh` (vídeo a partir de HTML; bom para cartelas
  animadas e motion graphics que não cabem no template do Remotion).
- **yt-dlp:** instalado, mas TikTok/Instagram/YouTube são bloqueados pela rede do ambiente.
  Pedir para o usuário mandar os arquivos de vídeo direto.

Se faltar algo: `npm ci` nesta pasta e
`pip install --break-system-packages faster-whisper==1.2.1 yt-dlp==2026.10.26`.

## Fluxo para cada vídeo
1. **Receber:** o upload chega em `/root/.claude/uploads/...`. Copiar para
   `material-bruto/<nome>.mp4` e conferir com `ffprobe` (resolução, duração, rotação).
   Se chegou em baixa resolução (WhatsApp), avisar e pedir o arquivo original.
2. **Assistir:** folha de contato (1 quadro a cada 2–3 s, com tempo) e ler a imagem;
   transcrever o bruto para entender a fala.
3. **Cortar pausas:** `python3 scripts/cortar_silencios.py material-bruto/x.mp4 trabalho/x-cortado.mp4`.
   Tirar erros e frases recomeçadas com cortes manuais no ffmpeg, guiados pela transcrição.
4. **Transcrever o cortado:** `python3 scripts/transcrever.py trabalho/x-cortado.mp4`.
   Corrigir palavras erradas direto no `.json`.
5. **Montar o projeto:** `python3 scripts/montar_props.py trabalho/x-cortado.mp4 transcricoes/x-cortado.json projetos/x`.
6. **Storyboard:** escrever `projetos/x/storyboard.md` (tabela: tempo, fala, visual — layout,
   cartela, zoom — e texto da cartela) seguindo o `estilo.md`. Mandar um resumo pro usuário e
   **esperar aprovação** antes da versão final. Para mostrar, renderizar quadros soltos:
   `npx remotion still Reels trabalho/quadro.png --props=projetos/x/props.json --frame=N`.
7. **Preencher o `props.json`** (gancho, cartelas, zooms, marca) conforme o storyboard aprovado.
   Imagens das cartelas vão em `remotion/public/`.
8. **Renderizar:** `npx remotion render Reels exportados/x.mp4 --props=projetos/x/props.json`.
   Conferir quadros-chave antes de enviar.
9. **Entregar** com SendUserFile. Ajustes: mexer no `props.json`/cortes e renderizar de novo.
10. **Commitar** `projetos/x/` (sem mídia) e dar push.

## Formato do `props.json`
```json
{
  "video": "x-cortado.mp4",
  "duracao": 58.4,
  "gancho": {"texto": "3 praias secretas perto de SP", "ate": 4.5},
  "cartelas": [
    {"inicio": 6.2, "fim": 10.0, "layout": "dividida", "passo": "1.", "titulo": "Praia X", "texto": "2h de carro", "imagem": "praia-x.jpg"},
    {"inicio": 50.0, "fim": 54.0, "layout": "cheia", "titulo": "Resumo", "imagem": "mapa.png"}
  ],
  "zooms": [{"inicio": 12.3, "fim": 14.0, "escala": 1.15}],
  "marca": "marca/logo.png",
  "estilo": {"destaque": "#E2553F", "palavrasPorLegenda": 2},
  "palavras": [{"palavra": "Três", "inicio": 0.0, "fim": 0.32}]
}
```
Campos de `estilo` (todos opcionais): `fundoCartela`, `destaque`, `corTexto`,
`palavrasPorLegenda`, `tamanhoLegenda`, `enquadramentoDividida`.

## Observações
- O ambiente na nuvem é temporário: a mídia não fica salva entre sessões. Vídeo final →
  mandar pro usuário. Para refazer, o usuário reenvia o bruto.
- Tempo de render: ~40 s para 16 s de vídeo (4 CPUs); 60 s de vídeo ≈ 2–3 min.
- Transcrição: ~23 s para 77 s de áudio (modelo turbo, CPU).
