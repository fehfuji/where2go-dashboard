import {Config} from '@remotion/cli/config';
import fs from 'node:fs';
import path from 'node:path';

// Usa o Chrome headless que já vem instalado na máquina (em vez de baixar um),
// porque a rede do ambiente na nuvem não libera o download do Remotion.
const acharChrome = (): string | null => {
	const base = '/opt/pw-browsers';
	if (!fs.existsSync(base)) return null;
	const pasta = fs
		.readdirSync(base)
		.filter((d) => d.startsWith('chromium_headless_shell-'))
		.sort()
		.pop();
	if (!pasta) return null;
	const exe = path.join(base, pasta, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
	return fs.existsSync(exe) ? exe : null;
};

const chrome = process.env.REMOTION_CHROME ?? acharChrome();
if (chrome) Config.setBrowserExecutable(chrome);

Config.setPublicDir('remotion/public');
Config.setEntryPoint('remotion/index.ts');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setCodec('h264');
Config.setCrf(18);
Config.setPixelFormat('yuv420p');
Config.setOverwriteOutput(true);
