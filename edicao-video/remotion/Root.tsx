import React from 'react';
import {Composition} from 'remotion';
import {Reels, type ReelsProps} from './Reels';

const FPS = 30;

// Props de exemplo só para abrir o Studio. Num projeto de verdade elas vêm de
// projetos/<nome>/props.json (gerado por scripts/montar_props.py).
const exemplo: ReelsProps = {
	video: 'exemplo.mp4',
	duracao: 5,
	palavras: [],
	gancho: {texto: 'Seu gancho aqui', ate: 3},
	cartelas: [],
	zooms: [],
};

export const Root: React.FC = () => (
	<Composition
		id="Reels"
		component={Reels}
		width={1080}
		height={1920}
		fps={FPS}
		durationInFrames={FPS * 5}
		defaultProps={exemplo}
		calculateMetadata={({props}) => ({
			durationInFrames: Math.max(1, Math.ceil(props.duracao * FPS)),
		})}
	/>
);
