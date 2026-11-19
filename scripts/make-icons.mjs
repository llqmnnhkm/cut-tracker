// Renders the app icons into public/. Run with: node scripts/make-icons.mjs
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const font = readFileSync('node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-800-italic.woff2').toString('base64');

const html = `<!doctype html>
<style>
  @font-face { font-family: BC; font-style: italic; font-weight: 800; src: url(data:font/woff2;base64,${font}); }
  html, body { margin: 0; height: 100%; }
  body { position: relative; overflow: hidden; background: #fc4c02; }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; }
</style>
<svg viewBox="0 0 512 512">
  <text x="256" y="350" text-anchor="middle" font-family="BC" font-style="italic" font-weight="800" font-size="270" fill="#fff">CUT</text>
</svg>`;

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `public/${name}` });
  await page.close();
}
await browser.close();
