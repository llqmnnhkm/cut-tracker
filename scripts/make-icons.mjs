// Renders the app icons into public/. Run with: node scripts/make-icons.mjs
import { chromium } from 'playwright';

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <rect width="512" height="512" fill="#f4efe4"/>
  <g stroke="#d9d0bd" stroke-width="6">
    <line x1="0" x2="512" y1="136" y2="136"/>
    <line x1="0" x2="512" y1="256" y2="256"/>
    <line x1="0" x2="512" y1="376" y2="376"/>
  </g>
  <line x1="104" x2="104" y1="0" y2="512" stroke="#b92e1c" stroke-width="7"/>
  <rect x="176" y="150" width="212" height="212" fill="#f4efe4" stroke="#1e1b16" stroke-width="16"/>
  <path d="M196 262c34 27 62 62 84 112 42-110 104-196 196-270" fill="none" stroke="#b92e1c" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const browser = await chromium.launch();
for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<!doctype html><body style="margin:0">${svg}</body>`);
  await page.screenshot({ path: `public/${name}` });
  await page.close();
}
await browser.close();
