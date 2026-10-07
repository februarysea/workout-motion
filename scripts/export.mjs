import { mkdir, writeFile } from 'node:fs/promises';
import { readFile, copyFile } from 'node:fs/promises';
import { exerciseIds, getExercise, renderSvg } from '../dist/h2.js';

const directory = new URL('../assets/', import.meta.url);
await mkdir(directory, { recursive: true });
const { license } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const notice = 'Required Notice: Copyright (c) 2026 februarysea and workout-motion contributors (https://github.com/februarysea/workout-motion)';
const licenseUrl = 'https://polyformproject.org/licenses/noncommercial/1.0.0';
for (const id of exerciseIds) {
  const svg = renderSvg(id, { phase: 0.2 });
  await writeFile(new URL(`${id}.svg`, directory), svg.replace(/(<svg\b[^>]*>)/, `$1<metadata>${notice}; ${license}; ${licenseUrl}; Commercial use outside the license permissions requires separate written permission.</metadata>`) + '\n');
}
await writeFile(new URL('manifest.json', directory), JSON.stringify(exerciseIds.map((id) => {
  const { label, chinese, durationMs } = getExercise(id);
  return { id, label, chinese, durationMs, still: `${id}.svg`, license, licenseUrl, artwork: 'original geometric SVG' };
}), null, 2) + '\n');
await copyFile(new URL('../LICENSE', import.meta.url), new URL('LICENSE', directory));
await copyFile(new URL('../NOTICE', import.meta.url), new URL('NOTICE', directory));
console.log(`Built ${exerciseIds.length} H2 motions and SVG stills.`);
