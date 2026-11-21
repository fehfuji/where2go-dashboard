import React, {useEffect, useMemo, useState} from 'react';
import {
	AbsoluteFill,
	Img,
	OffthreadVideo,
	continueRender,
	delayRender,
	interpolate,
	spring,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from 'remotion';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/800.css';

// ---------------------------------------------------------------------------
// Tipos das props (o arquivo projetos/<nome>/props.json segue este formato)
// ---------------------------------------------------------------------------

export type Palavra = {palavra: string; inicio: number; fim: number};

export type Cartela = {
	inicio: number;
	fim: number;
	/** "dividida": cartela em cima e rosto embaixo. "cheia": cartela na tela toda. */
	layout?: 'dividida' | 'cheia';
	/** Texto colorido antes do título, ex.: "Passo 1." */
	passo?: string;
	titulo?: string;
	texto?: string;
	/** Imagem em remotion/public (print, ícone, foto do destino...) */
	imagem?: string;
};

export type Zoom = {inicio: number; fim: number; escala?: number};

export type Estilo = {
	fundoCartela?: string;
	destaque?: string;
	corTexto?: string;
	palavrasPorLegenda?: number;
	tamanhoLegenda?: number;
	/** Quanto o vídeo desce no layout dividido (fração da altura). */
	enquadramentoDividida?: number;
};

export type ReelsProps = {
	video: string;
	duracao: number;
	palavras: Palavra[];
	gancho?: {texto: string; ate: number} | null;
	cartelas?: Cartela[];
	zooms?: Zoom[];
	marca?: string | null;
	estilo?: Estilo;
};

const PADRAO: Required<Estilo> = {
	fundoCartela: '#EEE8DC',
	destaque: '#E2553F',
	corTexto: '#2B2B2B',
	palavrasPorLegenda: 2,
	tamanhoLegenda: 84,
	enquadramentoDividida: 0.3,
};

const FONTE = 'Montserrat, Inter, system-ui, sans-serif';

const src = (arquivo: string) => (/^https?:\/\//.test(arquivo) ? arquivo : staticFile(arquivo));

// Espera as fontes carregarem antes de renderizar o primeiro quadro.
const useFontes = () => {
	const [handle] = useState(() => delayRender('Carregando fontes'));
	useEffect(() => {
		Promise.all(['600', '700', '800'].map((w) => document.fonts.load(`${w} 64px Montserrat`)))
			.finally(() => continueRender(handle));
	}, [handle]);
};

// ---------------------------------------------------------------------------
// Legendas palavra por palavra
// ---------------------------------------------------------------------------

type Grupo = {texto: string; inicio: number; fim: number};

const limpar = (p: string) => p.replace(/^["“”'(]+/, '').replace(/[.,!?;:…"“”')]+$/, '');

export const agruparPalavras = (palavras: Palavra[], max: number): Grupo[] => {
	const grupos: Grupo[] = [];
	let atual: Palavra[] = [];
	palavras.forEach((w, i) => {
		atual.push(w);
		const prox = palavras[i + 1];
		const fimDeFrase = /[.,!?;:…]$/.test(w.palavra.trim());
		const pausa = !prox || prox.inicio - w.fim > 0.35;
		const comprido = atual.map((x) => x.palavra).join(' ').length >= 14;
		if (atual.length >= max || fimDeFrase || pausa || comprido) {
			const texto = atual.map((x) => limpar(x.palavra.trim())).filter(Boolean).join(' ');
			if (texto) grupos.push({texto, inicio: atual[0].inicio, fim: w.fim});
			atual = [];
		}
	});
	// Segura cada legenda na tela até a próxima começar (no máx. +0,6 s) pra não piscar.
	grupos.forEach((g, i) => {
		const prox = grupos[i + 1];
		g.fim = prox ? Math.min(prox.inicio, g.fim + 0.6) : g.fim + 0.4;
	});
	return grupos;
};

const contorno = [
	'0 0 3px rgba(0,0,0,.9)',
	'2px 2px 0 rgba(0,0,0,.55)',
	'-2px 2px 0 rgba(0,0,0,.55)',
	'2px -2px 0 rgba(0,0,0,.55)',
	'-2px -2px 0 rgba(0,0,0,.55)',
	'0 6px 22px rgba(0,0,0,.55)',
].join(', ');

const Legenda: React.FC<{grupos: Grupo[]; topo: number; tamanho: number}> = ({grupos, topo, tamanho}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const t = frame / fps;
	const g = grupos.find((x) => t >= x.inicio && t < x.fim);
	if (!g) return null;
	const desde = frame - Math.round(g.inicio * fps);
	const escala = interpolate(desde, [0, 4], [0.82, 1], {extrapolateRight: 'clamp'});
	return (
		<AbsoluteFill style={{justifyContent: 'flex-start', alignItems: 'center'}}>
			<div
				style={{
					position: 'absolute',
					top: `${topo * 100}%`,
					transform: `translateY(-50%) scale(${escala})`,
					width: '90%',
					textAlign: 'center',
					fontFamily: FONTE,
					fontWeight: 800,
					fontSize: tamanho,
					lineHeight: 1.1,
					letterSpacing: -1,
					color: 'white',
					textShadow: contorno,
				}}
			>
				{g.texto}
			</div>
		</AbsoluteFill>
	);
};

// ---------------------------------------------------------------------------
// Cartelas (gráficos com texto/imagem)
// ---------------------------------------------------------------------------

const PainelCartela: React.FC<{c: Cartela; e: Required<Estilo>}> = ({c, e}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const desde = frame - Math.round(c.inicio * fps);
	const pop = spring({frame: desde, fps, config: {damping: 14, stiffness: 180}});
	const cheia = c.layout === 'cheia';
	return (
		<div
			style={{
				position: 'absolute',
				left: 0,
				top: 0,
				width: '100%',
				height: cheia ? '100%' : '50%',
				background: `radial-gradient(ellipse at 50% 40%, #F6F2EA 0%, ${e.fundoCartela} 70%)`,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: cheia ? 'center' : 'flex-start',
				paddingTop: cheia ? 0 : 150,
				gap: 48,
				fontFamily: FONTE,
				color: e.corTexto,
			}}
		>
			{(c.passo || c.titulo) && (
				<div style={{fontSize: cheia ? 64 : 52, fontWeight: 700, textAlign: 'center', padding: '0 60px'}}>
					{c.passo && <span style={{color: e.destaque}}>{c.passo} </span>}
					{c.titulo}
				</div>
			)}
			{c.imagem && (
				<Img
					src={src(c.imagem)}
					style={{
						maxWidth: '78%',
						maxHeight: cheia ? '55%' : 480,
						objectFit: 'contain',
						borderRadius: 24,
						boxShadow: '0 18px 50px rgba(0,0,0,.18)',
						transform: `scale(${0.9 + 0.1 * pop})`,
						opacity: pop,
					}}
				/>
			)}
			{c.texto && (
				<div
					style={{
						fontSize: cheia ? 48 : 40,
						fontWeight: 600,
						textAlign: 'center',
						maxWidth: '82%',
						lineHeight: 1.3,
						opacity: pop,
					}}
				>
					{c.texto}
				</div>
			)}
		</div>
	);
};

// ---------------------------------------------------------------------------
// Composição principal
// ---------------------------------------------------------------------------

export const Reels: React.FC<ReelsProps> = ({
	video,
	palavras,
	gancho,
	cartelas = [],
	zooms = [],
	marca,
	estilo,
}) => {
	useFontes();
	const frame = useCurrentFrame();
	const {fps, height} = useVideoConfig();
	const t = frame / fps;
	const e = {...PADRAO, ...(estilo ?? {})};

	const grupos = useMemo(() => agruparPalavras(palavras, e.palavrasPorLegenda), [palavras, e.palavrasPorLegenda]);

	const cartela = cartelas.find((c) => t >= c.inicio && t < c.fim);
	const zoom = zooms.find((z) => t >= z.inicio && t < z.fim);
	const dividida = cartela && cartela.layout !== 'cheia';
	const cheia = cartela && cartela.layout === 'cheia';

	// Corte seco no zoom (estilo "punch-in"), como nos Reels de referência.
	const escala = !cartela && zoom ? zoom.escala ?? 1.12 : 1;
	const desce = dividida ? e.enquadramentoDividida * height : 0;

	const topoLegenda = cheia ? 0.8 : dividida ? 0.5 : 0.68;

	return (
		<AbsoluteFill style={{backgroundColor: 'black'}}>
			<AbsoluteFill style={{transform: `translateY(${desce}px) scale(${escala})`, transformOrigin: '50% 40%'}}>
				<OffthreadVideo src={src(video)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
			</AbsoluteFill>

			{cartela && <PainelCartela key={`${cartela.inicio}`} c={cartela} e={e} />}

			{gancho && t < gancho.ate && !cartela && (
				<AbsoluteFill style={{alignItems: 'center'}}>
					<div
						style={{
							position: 'absolute',
							top: 210,
							width: '86%',
							textAlign: 'center',
							fontFamily: FONTE,
							fontWeight: 700,
							fontSize: 62,
							lineHeight: 1.2,
							color: 'white',
							textShadow: '0 3px 14px rgba(0,0,0,.6), 0 1px 3px rgba(0,0,0,.7)',
						}}
					>
						{gancho.texto}
					</div>
				</AbsoluteFill>
			)}

			<Legenda grupos={grupos} topo={topoLegenda} tamanho={e.tamanhoLegenda} />

			{marca && (
				<Img src={src(marca)} style={{position: 'absolute', top: 70, right: 60, width: 170, opacity: 0.9}} />
			)}
		</AbsoluteFill>
	);
};
