import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('.site/', root);
// Only this generated directory is cleared. Sources and local review exports stay intact.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const entry of await readdir(new URL('site/', root))) {
  await cp(new URL(`site/${entry}`, root), new URL(entry, output), { recursive: true });
}
for (const name of ['dist', 'assets', 'LICENSE', 'NOTICE', 'COMMERCIAL-LICENSE.md']) {
  await cp(new URL(name, root), new URL(name, output), { recursive: true });
}
await writeFile(new URL('.nojekyll', output), '');
// A release's downloads always follow its package version and built motion catalog.
const { version } = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const catalog = JSON.parse(await readFile(new URL('assets/manifest.json', root), 'utf8'));
const releaseUrl = `https://github.com/februarysea/workout-motion/releases/download/v${version}`;
await writeFile(new URL('downloads.json', output), JSON.stringify({
  version,
  library: `${releaseUrl}/workout-motion-${version}.zip`,
  svgs: `${releaseUrl}/workout-motion-svg-${version}.zip`,
  animations: Object.fromEntries(catalog.map(({ id }) => [id, `${releaseUrl}/${id}.gif`])),
}, null, 2) + '\n');
// The source templates remain readable; generated copy follows the accepted catalog.
for (const name of ['index.html', 'i18n.js']) {
  const path = new URL(name, output);
  const text = await readFile(path, 'utf8');
  await writeFile(path, text.replaceAll('__MOTION_COUNT__', String(catalog.length)));
}
const escape = (value) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const license = await readFile(new URL('LICENSE', root), 'utf8');
const notice = await readFile(new URL('NOTICE', root), 'utf8');
await writeFile(new URL('license.html', output), `<!doctype html>
<html lang="en" data-theme="dark">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="theme-color" content="#111111">
    <meta name="description" content="Usage, attribution and commercial permission for workout-motion under PolyForm Noncommercial 1.0.0.">
    <title>License · workout-motion</title>
    <link rel="icon" href="./favicon.svg" type="image/svg+xml">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="./style.css">
    <script type="module" src="./license.js"></script>
  </head>
  <body class="license-page">
    <header class="license-toolbar" aria-label="Page controls" data-i18n-label="toolbar">
      <a id="back-link" href="./index.html?lang=en" data-i18n="back">← Back to the collection</a>
      <div>
        <button id="language-toggle" type="button" lang="zh-CN" aria-label="Switch to Chinese">中文</button>
        <button id="theme-toggle" type="button" aria-pressed="true" aria-label="Switch to light theme">☀ Light</button>
      </div>
    </header>
    <main class="license-document" id="license-document">
      <header>
        <p>WORKOUT—MOTION / POLYFORM NONCOMMERCIAL 1.0.0</p>
        <h1 data-i18n="heading">Usage &amp; licensing</h1>
        <p data-i18n="summary">Free for noncommercial use. Commercial use requires written permission.</p>
        <p data-i18n="conditions">Keep attribution and license notices. Full terms govern.</p>
        <nav aria-label="License resources" data-i18n-label="resources">
          <a href="https://github.com/februarysea/workout-motion/issues/new?template=commercial-license.yml" target="_blank" rel="noopener noreferrer" data-i18n="request">Request commercial permission ↗</a>
        </nav>
      </header>
      <details id="license-terms">
        <summary data-i18n="termsHeading">Full terms</summary>
        <p><a href="https://polyformproject.org/licenses/noncommercial/1.0.0" target="_blank" rel="noopener noreferrer" data-i18n="canonical">Original license ↗</a></p>
        <pre id="license-standard" lang="en" tabindex="0" aria-label="PolyForm Noncommercial 1.0.0 in original English" data-i18n-label="termsLabel">${escape(license)}</pre>
      </details>
      <details id="project-notices">
        <summary data-i18n="noticeHeading">Notices</summary>
        <pre id="license-notice" lang="en" tabindex="0" aria-label="Project notice in original English" data-i18n-label="noticeLabel">${escape(notice)}</pre>
      </details>
    </main>
  </body>
</html>`);
console.log(`Static site: ${fileURLToPath(output)}`);
console.log('Preview with pnpm dev: http://127.0.0.1:4325/.site/index.html');
